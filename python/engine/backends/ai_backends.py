import asyncio
from typing import Optional
from ..base import BaseBackend, ScrapeResult


class Crawl4AIBackend(BaseBackend):
    name = "crawl4ai"
    priority = 9

    async def check_available(self) -> bool:
        try:
            from crawl4ai import AsyncWebCrawler
            return True
        except ImportError:
            return False

    async def scrape(self, url: str, **kwargs) -> Optional[ScrapeResult]:
        from crawl4ai import AsyncWebCrawler
        from crawl4ai.async_configs import BrowserConfig, CrawlerRunConfig
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
                sr = ScrapeResult(url=url, html=result.html or "", source=self.name)
                sr.markdown = result.markdown or ""
                if result.screenshot:
                    import base64
                    sr.screenshot_base64 = base64.b64encode(result.screenshot).decode("utf-8")
                return sr
        except Exception:
            return None


class JinaReaderBackend(BaseBackend):
    name = "jina-reader"
    priority = 4

    async def check_available(self) -> bool:
        import httpx
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get("https://r.jina.ai/", follow_redirects=True)
                return resp.status_code < 500
            return False
        except Exception:
            return False

    async def scrape(self, url: str, **kwargs) -> Optional[ScrapeResult]:
        import httpx
        try:
            async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
                resp = await client.get(
                    f"https://r.jina.ai/{url}",
                    headers={"Accept": "text/markdown"}
                )
                resp.raise_for_status()
                sr = ScrapeResult(url=url, source=self.name)
                sr.markdown = resp.text
                return sr
        except Exception:
            return None


class FirecrawlBackend(BaseBackend):
    name = "firecrawl"
    priority = 15
    requires_docker = True

    def __init__(self, api_url: str = "http://localhost:3000"):
        self.api_url = api_url

    async def check_available(self) -> bool:
        import httpx
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(f"{self.api_url}/health")
                return resp.status_code == 200
        except Exception:
            return False

    async def scrape(self, url: str, **kwargs) -> Optional[ScrapeResult]:
        import httpx
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    f"{self.api_url}/v1/scrape",
                    json={"url": url, "formats": ["markdown", "html"]}
                )
                resp.raise_for_status()
                data = resp.json()
                sr = ScrapeResult(url=url, source=self.name)
                sr.markdown = data.get("data", {}).get("markdown", "")
                sr.html = data.get("data", {}).get("html", "")
                return sr
        except Exception:
            return None


class ScrapeGraphAIBackend(BaseBackend):
    name = "scrapegraph-ai"
    priority = 16

    def __init__(self, api_key: str = ""):
        self.api_key = api_key

    async def check_available(self) -> bool:
        return bool(self.api_key)

    async def scrape(self, url: str, **kwargs) -> Optional[ScrapeResult]:
        if not self.api_key:
            return None
        import httpx
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    "https://api.scrapegraphai.com/v1/scrape",
                    json={"url": url, "prompt": "Extract all content including title, description, text, metadata"},
                    headers={"Authorization": f"Bearer {self.api_key}"}
                )
                resp.raise_for_status()
                data = resp.json()
                sr = ScrapeResult(url=url, source=self.name)
                sr.text = data.get("text", "")
                sr.metadata = data.get("metadata", {})
                return sr
        except Exception:
            return None
