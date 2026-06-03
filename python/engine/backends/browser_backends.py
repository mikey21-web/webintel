import asyncio
import base64
from typing import Optional
from ..base import BaseBackend, ScrapeResult


class PlaywrightBackend(BaseBackend):
    name = "playwright"
    priority = 10

    async def check_available(self) -> bool:
        try:
            from playwright.async_api import async_playwright
            return True
        except ImportError:
            return False

    async def scrape(self, url: str, **kwargs) -> Optional[ScrapeResult]:
        from playwright.async_api import async_playwright
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                await page.goto(url, wait_until="networkidle", timeout=30000)
                html = await page.content()
                title = await page.title()
                screenshot_b64 = None
                if kwargs.get("screenshot"):
                    screenshot = await page.screenshot(full_page=kwargs.get("full_page", True))
                    screenshot_b64 = base64.b64encode(screenshot).decode("utf-8")
                await browser.close()
                result = ScrapeResult(url=url, html=html, source=self.name)
                result.title = title
                result.screenshot_base64 = screenshot_b64
                return result
        except Exception:
            return None


class UndetectedChromeBackend(BaseBackend):
    name = "undetected-chromedriver"
    priority = 11

    async def check_available(self) -> bool:
        try:
            import undetected_chromedriver as uc
            return True
        except ImportError:
            return False

    async def scrape(self, url: str, **kwargs) -> Optional[ScrapeResult]:
        import undetected_chromedriver as uc
        from selenium.webdriver.common.by import By
        try:
            def _fetch():
                driver = uc.Chrome(headless=True)
                try:
                    driver.get(url)
                    import time
                    time.sleep(3)
                    return driver.page_source
                finally:
                    driver.quit()
            html = await asyncio.get_event_loop().run_in_executor(None, _fetch)
            return ScrapeResult(url=url, html=html, source=self.name)
        except Exception:
            return None


class NodriverBackend(BaseBackend):
    name = "nodriver"
    priority = 12

    async def check_available(self) -> bool:
        try:
            import nodriver
            return True
        except ImportError:
            return False

    async def scrape(self, url: str, **kwargs) -> Optional[ScrapeResult]:
        import nodriver
        try:
            browser = await nodriver.start()
            page = await browser.get(url)
            await page.wait_for(3)
            html = await page.content()
            title = await page.title()
            await browser.stop()
            result = ScrapeResult(url=url, html=html, source=self.name)
            result.title = title
            return result
        except Exception:
            return None


class SeleniumBackend(BaseBackend):
    name = "selenium"
    priority = 14

    async def check_available(self) -> bool:
        try:
            from selenium import webdriver
            from selenium.webdriver.chrome.options import Options
            return True
        except ImportError:
            return False

    async def scrape(self, url: str, **kwargs) -> Optional[ScrapeResult]:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        try:
            def _fetch():
                opts = Options()
                opts.add_argument("--headless=new")
                opts.add_argument("--no-sandbox")
                driver = webdriver.Chrome(options=opts)
                try:
                    driver.get(url)
                    import time
                    time.sleep(3)
                    return driver.page_source
                finally:
                    driver.quit()
            html = await asyncio.get_event_loop().run_in_executor(None, _fetch)
            return ScrapeResult(url=url, html=html, source=self.name)
        except Exception:
            return None


class CamoufoxBackend(BaseBackend):
    name = "camoufox"
    priority = 13
    requires_binary = True

    async def check_available(self) -> bool:
        try:
            from camoufox import Camoufox
            return True
        except ImportError:
            return False

    async def scrape(self, url: str, **kwargs) -> Optional[ScrapeResult]:
        from camoufox import Camoufox
        try:
            async with Camoufox(headless=True) as browser:
                page = await browser.new_page()
                await page.goto(url, wait_until="networkidle", timeout=30000)
                html = await page.content()
                title = await page.title()
                result = ScrapeResult(url=url, html=html, source=self.name)
                result.title = title
                return result
        except Exception:
            return None
