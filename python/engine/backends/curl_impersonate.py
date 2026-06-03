import asyncio
import subprocess
from typing import Optional
from ..base import BaseBackend, ScrapeResult


class CurlImpersonateBackend(BaseBackend):
    name = "curl-impersonate"
    priority = 3
    requires_binary = True

    async def check_available(self) -> bool:
        import shutil
        return shutil.which("curl-impersonate-chrome") is not None

    async def scrape(self, url: str, **kwargs) -> Optional[ScrapeResult]:
        try:
            proc = await asyncio.create_subprocess_exec(
                "curl-impersonate-chrome", url,
                "-s", "-o", "-",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                timeout=30,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=30)
            if stdout:
                html = stdout.decode("utf-8", errors="replace")
                return ScrapeResult(url=url, html=html, source=self.name)
        except Exception:
            return None
        return None
