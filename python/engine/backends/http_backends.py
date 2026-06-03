import asyncio
from typing import Optional
from ..base import BaseBackend, ScrapeResult


class HTTPXBackend(BaseBackend):
    name = "httpx"
    priority = 1

    async def check_available(self) -> bool:
        try:
            import httpx
            return True
        except ImportError:
            return False

    async def scrape(self, url: str, **kwargs) -> Optional[ScrapeResult]:
        import httpx
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                resp = await client.get(url, headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                })
                resp.raise_for_status()
                return ScrapeResult(url=url, html=resp.text, source=self.name)
        except Exception:
            return None


class AiohttpBackend(BaseBackend):
    name = "aiohttp"
    priority = 2

    async def check_available(self) -> bool:
        try:
            import aiohttp
            return True
        except ImportError:
            return False

    async def scrape(self, url: str, **kwargs) -> Optional[ScrapeResult]:
        import aiohttp
        try:
            async with aiohttp.ClientSession(headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }) as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(30)) as resp:
                    html = await resp.text()
                    return ScrapeResult(url=url, html=html, source=self.name)
        except Exception:
            return None


class CurlCFFIBackend(BaseBackend):
    name = "curl_cffi"
    priority = 3

    async def check_available(self) -> bool:
        try:
            from curl_cffi import requests
            return True
        except ImportError:
            return False

    async def scrape(self, url: str, **kwargs) -> Optional[ScrapeResult]:
        from curl_cffi import requests
        try:
            resp = await asyncio.get_event_loop().run_in_executor(
                None, lambda: requests.get(url, impersonate="chrome124")
            )
            return ScrapeResult(url=url, html=resp.text, source=self.name)
        except Exception:
            return None


class RequestsHTMLBackend(BaseBackend):
    name = "requests-html"
    priority = 6

    async def check_available(self) -> bool:
        try:
            from requests_html import HTMLSession
            return True
        except ImportError:
            return False

    async def scrape(self, url: str, **kwargs) -> Optional[ScrapeResult]:
        from requests_html import HTMLSession
        try:
            def _fetch():
                session = HTMLSession()
                resp = session.get(url)
                resp.html.render(timeout=30, sleep=2)
                return resp.html.html
            html = await asyncio.get_event_loop().run_in_executor(None, _fetch)
            return ScrapeResult(url=url, html=html, source=self.name)
        except Exception:
            return None
