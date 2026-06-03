import asyncio
import base64
import re
from typing import Optional

import httpx
import trafilatura
from selectolax.parser import HTMLParser
from crawl4ai import AsyncWebCrawler
from crawl4ai.async_configs import BrowserConfig, CrawlerRunConfig


def _extract_meta(html: str) -> dict:
    tree = HTMLParser(html)
    meta = {"title": "", "description": "", "ogImage": ""}
    title_tag = tree.css_first("title")
    if title_tag:
        meta["title"] = title_tag.text(strip=True)
    for tag in tree.css("meta"):
        name = tag.attributes.get("name", "") or tag.attributes.get("property", "")
        content = tag.attributes.get("content", "")
        if name.lower() in ("description", "og:description"):
            meta["description"] = content or meta["description"]
        if name.lower() in ("og:image", "twitter:image"):
            meta["ogImage"] = content or meta["ogImage"]
    return meta


def _parse_html(html: str) -> tuple[str, dict]:
    markdown = trafilatura.extract(html, output_format="markdown", include_links=True) or ""
    meta = _extract_meta(html)
    return markdown, meta


async def try_httpx(url: str, *, proxy: Optional[dict] = None) -> Optional[dict]:
    try:
        client_kwargs = dict(timeout=30.0, follow_redirects=True)
        if proxy:
            client_kwargs["proxies"] = proxy
        async with httpx.AsyncClient(**client_kwargs) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
            resp.raise_for_status()
            html = resp.text
            markdown, meta = _parse_html(html)
            return {
                "markdown": markdown,
                "html": html,
                "metadata": meta,
                "source": "httpx",
                "screenshotBase64": None,
            }
    except Exception:
        return None


async def try_playwright(url: str, *, screenshot: bool = False, full_page: bool = True) -> Optional[dict]:
    try:
        browser_cfg = BrowserConfig(headless=True, browser_type="chromium")
        run_cfg = CrawlerRunConfig(
            word_count_threshold=10,
            extraction_strategy="NoExtractionStrategy",
            bypass_cache=True,
            verbose=False,
        )
        async with AsyncWebCrawler(config=browser_cfg) as crawler:
            result = await crawler.arun(url=url, config=run_cfg)
            if not result.success:
                return None
            html = result.html or ""
            markdown, meta = _parse_html(html)
            screenshot_b64 = None
            if screenshot and result.screenshot:
                screenshot_b64 = base64.b64encode(result.screenshot).decode("utf-8")
            return {
                "markdown": markdown,
                "html": html,
                "metadata": meta,
                "source": "playwright",
                "screenshotBase64": screenshot_b64,
            }
    except Exception:
        return None


async def try_curl_cffi(url: str) -> Optional[dict]:
    try:
        from curl_cffi import requests as curl_req
        resp = curl_req.get(url, impersonate="chrome124")
        html = resp.text
        markdown, meta = _parse_html(html)
        return {
            "markdown": markdown,
            "html": html,
            "metadata": meta,
            "source": "curl_cffi",
            "screenshotBase64": None,
        }
    except Exception:
        return None


async def scrape_with_fallback(url: str, *, screenshot: bool = False, full_page: bool = True, proxy: Optional[dict] = None) -> dict:
    if not screenshot:
        result = await try_httpx(url, proxy=proxy)
        if result:
            return result
    result = await try_playwright(url, screenshot=screenshot, full_page=full_page)
    if result:
        return result
    result = await try_curl_cffi(url)
    if result:
        return result
    return {
        "markdown": "",
        "html": "",
        "metadata": {"title": "", "description": "", "ogImage": ""},
        "source": "none",
        "screenshotBase64": None,
    }
