import asyncio
import json
import os
import tempfile
from typing import Optional
from ..base import BaseBackend, ScrapeResult


PUPPETEER_SCRIPT = """
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.goto(process.argv[2], { waitUntil: 'networkidle2', timeout: 30000 });
    const html = await page.content();
    const title = await page.title();
    const links = await page.evaluate(() => Array.from(document.querySelectorAll('a[href]'), a => a.href));
    console.log(JSON.stringify({ html, title, links }));
    await browser.close();
})();
"""

CRAWLEE_SCRIPT = """
const { Crawlee } = require('crawlee');
const { cheerioCrawler } = require('crawlee');

(async () => {
    let result = {};
    const crawler = new cheerioCrawler.CheerioCrawler({
        maxRequestsPerCrawl: 1,
        requestHandler: async ({ request, $ }) => {
            result.html = $.html();
            result.title = $('title').text();
        },
    });
    await crawler.run([process.argv[2]]);
    console.log(JSON.stringify(result));
})();
"""

GOT_SCRIPT = """
const gotScraping = require('got-scraping');

(async () => {
    try {
        const { body } = await gotScraping.gotScraping({ url: process.argv[2] });
        console.log(body.substring(0, 200000));
    } catch (e) {
        process.stderr.write(e.message);
    }
})();
"""


async def _node_available() -> bool:
    try:
        proc = await asyncio.create_subprocess_exec(
            "node", "--version",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
        return stdout.decode().startswith("v")
    except Exception:
        return False


async def _npm_package_available(pkg: str) -> bool:
    try:
        proc = await asyncio.create_subprocess_exec(
            "node", "-e", f"require('{pkg}'); console.log('ok')",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=10)
        return stdout.decode().strip() == "ok"
    except Exception:
        return False


async def _run_node_script(script: str, url: str, timeout: int = 45) -> Optional[str]:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".js", delete=False) as f:
        f.write(script)
        script_path = f.name
    try:
        proc = await asyncio.create_subprocess_exec(
            "node", script_path, url,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        return stdout.decode() if stdout else None
    except Exception:
        return None
    finally:
        try:
            os.unlink(script_path)
        except OSError:
            pass


class PuppeteerStealthBackend(BaseBackend):
    name = "puppeteer-extra-stealth"
    priority = 14
    requires_node = True

    async def check_available(self) -> bool:
        return await _node_available() and await _npm_package_available("puppeteer-extra")

    async def scrape(self, url: str, **kwargs) -> Optional[ScrapeResult]:
        output = await _run_node_script(PUPPETEER_SCRIPT, url, timeout=45)
        if output:
            try:
                data = json.loads(output)
                sr = ScrapeResult(url=url, html=data.get("html", ""), source=self.name)
                sr.title = data.get("title", "")
                return sr
            except json.JSONDecodeError:
                pass
        return None


class CrawleeNodeBackend(BaseBackend):
    name = "crawlee-node"
    priority = 8
    requires_node = True

    async def check_available(self) -> bool:
        return await _node_available() and await _npm_package_available("crawlee")

    async def scrape(self, url: str, **kwargs) -> Optional[ScrapeResult]:
        output = await _run_node_script(CRAWLEE_SCRIPT, url, timeout=30)
        if output:
            try:
                data = json.loads(output)
                sr = ScrapeResult(url=url, html=data.get("html", ""), source=self.name)
                sr.title = data.get("title", "")
                sr.links_internal = data.get("links", [])
                return sr
            except json.JSONDecodeError:
                pass
        return None


class GotScrapingBackend(BaseBackend):
    name = "got-scraping"
    priority = 3
    requires_node = True

    async def check_available(self) -> bool:
        return await _node_available() and await _npm_package_available("got-scraping")

    async def scrape(self, url: str, **kwargs) -> Optional[ScrapeResult]:
        output = await _run_node_script(GOT_SCRIPT, url, timeout=30)
        if output:
            return ScrapeResult(url=url, html=output, source=self.name)
        return None
