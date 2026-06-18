import asyncio
import json
import os
import tempfile
from typing import Optional
from ..base import BaseBackend, ScrapeResult


class ScrapyBackend(BaseBackend):
    name = "scrapy"
    priority = 18

    def __init__(self, redis_url: str = "", frontera_settings: dict = None):
        self.redis_url = redis_url
        self.frontera_settings = frontera_settings or {}

    async def check_available(self) -> bool:
        try:
            import scrapy
            return True
        except ImportError:
            return False

    async def _has_playwright(self) -> bool:
        try:
            from scrapy_playwright import ScrapyPlaywright
            return True
        except ImportError:
            return False

    async def _has_redis(self) -> bool:
        try:
            from scrapy_redis import RedisSpider
            return True
        except ImportError:
            return False

    async def _has_frontera(self) -> bool:
        try:
            from frontera import FrontierManager
            return True
        except ImportError:
            return False

    async def scrape(self, url: str, **kwargs) -> Optional[ScrapeResult]:
        import scrapy
        from scrapy.crawler import CrawlerRunner
        from scrapy.utils.project import get_project_settings
        try:
            results = []
            has_playwright = await self._has_playwright()
            has_redis = await self._has_redis()

            class ExtractSpider(scrapy.Spider if not has_redis else type("", (), {})):
                name = "extract"
                start_urls = [url]

                def parse(self, response):
                    results.append({
                        "html": response.text,
                        "title": response.css("title::text").get(""),
                    })

            if has_playwright:

                class ExtractSpiderPW(scrapy.Spider):
                    name = "extract_pw"
                    start_urls = [url]

                    def start_requests(self):
                        yield scrapy.Request(
                            url,
                            meta={"playwright": True, "playwright_include_page": False},
                            callback=self.parse,
                        )

                    def parse(self, response):
                        results.append({
                            "html": response.text,
                            "title": response.css("title::text").get(""),
                        })

                spider_cls = ExtractSpiderPW
            else:
                spider_cls = ExtractSpider

            settings = get_project_settings()
            settings.set("LOG_ENABLED", False)
            settings.set("CONCURRENT_REQUESTS", 1)
            settings.set("DOWNLOAD_DELAY", 0.5)
            if has_playwright:
                settings.set("PLAYWRIGHT_LAUNCH_OPTIONS", {"headless": True})
                settings.set("DOWNLOAD_HANDLERS", {
                    "http": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
                    "https": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
                })
            if has_redis and self.redis_url:
                settings.set("SCHEDULER", "scrapy_redis.scheduler.Scheduler")
                settings.set("SCHEDULER_PERSIST", True)
                settings.set("REDIS_URL", self.redis_url)

            runner = CrawlerRunner(settings)
            await runner.crawl(spider_cls)
            if results:
                sr = ScrapeResult(url=url, html=results[0]["html"], source=self.name)
                sr.title = results[0]["title"]
                if await self._has_frontera():
                    sr.source = "scrapy+frontera"
                if has_playwright:
                    sr.source += "+playwright"
                if has_redis and self.redis_url:
                    sr.source += "+redis"
                return sr
        except Exception:
            return None
        return None


class CrawleeBackend(BaseBackend):
    name = "crawlee-python"
    priority = 8

    async def check_available(self) -> bool:
        try:
            from crawlee import Crawlee
            return True
        except ImportError:
            return False

    async def scrape(self, url: str, **kwargs) -> Optional[ScrapeResult]:
        from crawlee.crawlers import PlaywrightCrawler
        from crawlee.router import Router
        try:
            html_result = []

            router = Router()
            @router.default_handler
            async def handler(context):
                html_result.append(await context.page.content())
                return

            crawler = PlaywrightCrawler(
                request_handler=router,
                max_requests_per_crawl=1,
                headless=True,
            )
            await crawler.run([url])
            if html_result:
                return ScrapeResult(url=url, html=html_result[0], source=self.name)
        except Exception:
            return None
        return None


class ScraplingBackend(BaseBackend):
    name = "scrapling"
    priority = 5

    async def check_available(self) -> bool:
        try:
            import scrapling
            return True
        except ImportError:
            return False

    async def scrape(self, url: str, **kwargs) -> Optional[ScrapeResult]:
        import httpx
        from scrapling import Fetcher
        try:
            fetcher = Fetcher()
            page = await asyncio.get_event_loop().run_in_executor(
                None, lambda: fetcher.get(url)
            )
            if page and page.content:
                return ScrapeResult(url=url, html=page.content, source=self.name)
        except Exception:
            return None
        return None


class BotasaurusBackend(BaseBackend):
    name = "botasaurus"
    priority = 7

    async def check_available(self) -> bool:
        try:
            import botasaurus
            return True
        except ImportError:
            return False

    async def scrape(self, url: str, **kwargs) -> Optional[ScrapeResult]:
        from botasaurus import scrape, bt
        try:
            result = []

            @scrape
            def fetch_url(driver: bt.Driver, url_to_get):
                driver.get(url_to_get)
                return {"html": driver.page_source, "title": driver.title}

            output = await asyncio.get_event_loop().run_in_executor(
                None, lambda: fetch_url(url)
            )
            if output:
                sr = ScrapeResult(url=url, html=output.get("html", ""), source=self.name)
                sr.title = output.get("title", "")
                return sr
        except Exception:
            return None
        return None


class MechanicalSoupBackend(BaseBackend):
    name = "mechanicalsoup"
    priority = 4

    async def check_available(self) -> bool:
        try:
            import mechanicalsoup
            return True
        except ImportError:
            return False

    async def scrape(self, url: str, **kwargs) -> Optional[ScrapeResult]:
        import mechanicalsoup
        try:
            def _fetch():
                browser = mechanicalsoup.StatefulBrowser()
                resp = browser.open(url)
                return resp.text if resp else ""
            html = await asyncio.get_event_loop().run_in_executor(None, _fetch)
            if html:
                return ScrapeResult(url=url, html=html, source=self.name)
        except Exception:
            return None
        return None
