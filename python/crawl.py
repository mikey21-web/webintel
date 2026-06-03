import asyncio
from urllib.parse import urlparse, urljoin
from typing import AsyncGenerator, Optional
import re

from crawl4ai import AsyncWebCrawler
from crawl4ai.async_configs import BrowserConfig, CrawlerRunConfig


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
                result = await crawler.arun(url=url, config=run_cfg)
                if not result.success:
                    continue
                markdown = result.markdown or ""

                yield f'{{"url":"{url}","markdown":"{markdown.replace(chr(34), chr(92) + chr(34)).replace(chr(10), chr(92) + chr(110)).replace(chr(13), "")}","depth":{depth}}}\n'

                if depth < max_depth and result.links:
                    internal_links = result.links.get("internal", []) or []
                    for link in internal_links:
                        href = link.get("href", "") if isinstance(link, dict) else getattr(link, "href", "")
                        if not href:
                            continue
                        absolute = urljoin(url, href)
                        if _is_same_domain(absolute, base_domain) and absolute not in visited:
                            queue.append((absolute, depth + 1))
            except Exception:
                continue
