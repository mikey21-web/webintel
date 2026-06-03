import json
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from fallback import scrape_with_fallback
from crawl import crawl_site

app = FastAPI(title="WebIntel API", version="2.0.0", docs_url="/docs")


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
