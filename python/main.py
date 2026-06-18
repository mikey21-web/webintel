import ipaddress
import json
import re
from typing import Optional
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from fallback import scrape_with_fallback
from crawl import crawl_site
from parser import fetch_document, pdf_to_markdown, docx_to_markdown, is_document_url
from engine.session_manager import get_session_manager

app = FastAPI(title="WebIntel API", version="2.0.0", docs_url="/docs")

PRIVATE_BLOCKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
]


def validate_url(url: str):
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        raise HTTPException(status_code=400, detail="Invalid URL")
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Only http/https URLs allowed")
    host = parsed.hostname
    if host in ("localhost", "127.0.0.1", "::1") or host.endswith(".local") or host.endswith(".internal"):
        raise HTTPException(status_code=400, detail="Private/internal hostnames not allowed")
    try:
        addr = ipaddress.ip_address(host)
        for block in PRIVATE_BLOCKS:
            if addr in block:
                raise HTTPException(status_code=400, detail="Private IP ranges not allowed")
    except ValueError:
        pass


class ScrapeRequest(BaseModel):
    url: str
    waitFor: Optional[int] = None
    screenshot: bool = False
    fullPage: bool = True
    useJs: bool = True
    stealth: bool = True


class CrawlRequest(BaseModel):
    url: str
    maxPages: int = 50
    maxDepth: int = 3
    includePattern: Optional[str] = None


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "webintel",
        "version": "2.0.0",
    }


@app.post("/scrape")
async def scrape(req: ScrapeRequest):
    validate_url(req.url)
    try:
        result = await scrape_with_fallback(
            req.url,
            screenshot=req.screenshot,
            full_page=req.fullPage,
        )
        if result["source"] == "none":
            raise HTTPException(status_code=502, detail="All 50 backends failed")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/scrape")
async def scrape_get(url: str = Query(...), screenshot: bool = False):
    validate_url(url)
    try:
        result = await scrape_with_fallback(
            url,
            screenshot=screenshot,
        )
        if result["source"] == "none":
            raise HTTPException(status_code=502, detail="All backends failed")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/crawl")
async def crawl(req: CrawlRequest):
    validate_url(req.url)
    async def event_stream():
        async for line in crawl_site(
            start_url=req.url,
            max_pages=req.maxPages,
            max_depth=req.maxDepth,
            include_pattern=req.includePattern,
        ):
            yield line

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


@app.get("/backends")
async def list_backends():
    from engine.backends import ALL_BACKENDS
    return {
        "total": len(ALL_BACKENDS),
        "backends": [
            {
                "name": cls.name,
                "priority": cls.priority,
                "requires_docker": cls.requires_docker,
                "requires_node": cls.requires_node,
                "requires_binary": cls.requires_binary,
            }
            for cls in ALL_BACKENDS
        ],
    }


@app.post("/parse")
async def parse_document(url: str = Query(...)):
    """Fetch and parse a PDF or DOCX document from a URL, returning clean markdown."""
    validate_url(url)
    try:
        raw_bytes, content_type, doc_type = await fetch_document(url)

        if doc_type == "pdf":
            markdown, meta = pdf_to_markdown(raw_bytes)
        elif doc_type == "docx":
            markdown, meta = docx_to_markdown(raw_bytes)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported document type: {content_type}")

        return {
            "url": url,
            "markdown": markdown,
            "documentType": doc_type,
            "contentType": content_type,
            "sizeBytes": len(raw_bytes),
            "metadata": meta,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document parse failed: {str(e)}")


# ---------------------------------------------------------------------------
# Managed browser sessions (CDP WebSocket for agents)
# ---------------------------------------------------------------------------

@app.post("/session")
async def create_session(headless: bool = True):
    mgr = get_session_manager()
    try:
        session = await mgr.create_session(headless=headless)
        return {
            "sessionId": session.session_id,
            "cdpWsUrl": session.cdp_ws_url,
            "pageUrl": session.page_url,
            "createdAt": session.created_at,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Session creation failed: {str(e)}")


@app.get("/session/{session_id}")
async def get_session(session_id: str):
    mgr = get_session_manager()
    session = await mgr.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "sessionId": session.session_id,
        "cdpWsUrl": session.cdp_ws_url,
        "pageUrl": session.page_url,
        "alive": session.alive,
        "idleSeconds": session.idle_seconds,
    }


@app.post("/session/{session_id}/navigate")
async def navigate_session(session_id: str, url: str = Query(...)):
    validate_url(url)
    mgr = get_session_manager()
    try:
        session = await mgr.navigate_session(session_id, url)
        return {
            "sessionId": session.session_id,
            "pageUrl": session.page_url,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Navigation failed: {str(e)}")


@app.delete("/session/{session_id}")
async def destroy_session(session_id: str):
    mgr = get_session_manager()
    destroyed = await mgr.destroy_session(session_id)
    if not destroyed:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"sessionId": session_id, "destroyed": True}
