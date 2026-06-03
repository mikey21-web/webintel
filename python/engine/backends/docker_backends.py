from typing import Optional
from ..base import BaseBackend, ScrapeResult


class SplashBackend(BaseBackend):
    name = "splash"
    priority = 17
    requires_docker = True

    def __init__(self, url: str = "http://localhost:8050"):
        self.service_url = url

    async def check_available(self) -> bool:
        import httpx
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(f"{self.service_url}/_ping")
                return resp.status_code == 200
        except Exception:
            return False

    async def scrape(self, url: str, **kwargs) -> Optional[ScrapeResult]:
        import httpx
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    f"{self.service_url}/render.html",
                    json={"url": url, "wait": 3, "timeout": 30}
                )
                resp.raise_for_status()
                return ScrapeResult(url=url, html=resp.text, source=self.name)
        except Exception:
            return None


class BrowserlessBackend(BaseBackend):
    name = "browserless"
    priority = 17
    requires_docker = True

    def __init__(self, url: str = "http://localhost:3000"):
        self.service_url = url

    async def check_available(self) -> bool:
        import httpx
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(f"{self.service_url}/health")
                return resp.status_code == 200
        except Exception:
            return False

    async def scrape(self, url: str, **kwargs) -> Optional[ScrapeResult]:
        import httpx
        import base64
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                payload = {"url": url, "options": {"waitFor": 3000}}
                resp = await client.post(
                    f"{self.service_url}/function",
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                resp.raise_for_status()
                data = resp.json()
                sr = ScrapeResult(url=url, source=self.name)
                sr.html = data.get("html", "")
                sr.markdown = data.get("markdown", "")
                if data.get("screenshot"):
                    sr.screenshot_base64 = base64.b64encode(bytes(data["screenshot"])).decode()
                return sr
        except Exception:
            return None
