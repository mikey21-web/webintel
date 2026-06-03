import asyncio
import json
import re
from urllib.parse import urlparse, urljoin
from typing import AsyncGenerator, Optional

from crawl4ai import AsyncWebCrawler
from crawl4ai.async_configs import BrowserConfig, CrawlerRunConfig

from engine.orchestrator import ExtractionOrchestrator


def _is_same_domain(url: str, base_domain: str) -> bool:
    return urlparse(url).netloc.replace("www.", "") == base_domain


def _matches_pattern(url: str, pattern: Optional[str]) -> bool:
    if not pattern:
        return True
    return re.search(pattern, url) is not None


async def crawl_site(
    start_url: str,
    max_pages: int = 50,
    max_depth: int = 3,
    include_pattern: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    base_domain = urlparse(start_url).netloc.replace("www.", "")
    visited: set[str] = set()
    queue: list[tuple[str, int]] = [(start_url, 0)]
    orch = ExtractionOrchestrator()
    await orch.init_backends()

    browser_cfg = BrowserConfig(headless=True, browser_type="chromium")
    run_cfg = CrawlerRunConfig(
        word_count_threshold=10,
        extraction_strategy="NoExtractionStrategy",
        bypass_cache=True,
        verbose=False,
    )

    async with AsyncWebCrawler(config=browser_cfg) as crawler:
        while queue and len(visited) < max_pages:
            url, depth = queue.pop(0)
            if url in visited or depth > max_depth:
                continue
            if not _matches_pattern(url, include_pattern):
                visited.add(url)
                continue
            visited.add(url)

            try:
                page_result = await orch.extract(url)
                if not page_result.html:
                    crawl_result = await crawler.arun(url=url, config=run_cfg)
                    if crawl_result.success:
                        page_result.html = crawl_result.html or ""
                        page_result.markdown = crawl_result.markdown or ""

                from fallback import result_to_dict
                data = result_to_dict(page_result)
                data["url"] = url
                data["depth"] = depth
                yield json.dumps(data) + "\n"

                if depth < max_depth and page_result.links_internal:
                    for href in page_result.links_internal:
                        absolute = urljoin(url, href)
                        if absolute not in visited:
                            queue.append((absolute, depth + 1))
            except Exception:
                continue
