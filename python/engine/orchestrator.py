import asyncio
import logging
from typing import Optional

from .base import ScrapeResult
from .backends import ALL_BACKENDS
from .extractors import ALL_EXTRACTORS
from .post_processors import ALL_PROCESSORS

logger = logging.getLogger(__name__)


class ExtractionOrchestrator:
    def __init__(self):
        self.backends = []
        self.extractors = [cls() for cls in ALL_EXTRACTORS]
        self.processors = [cls() for cls in ALL_PROCESSORS]

    async def init_backends(self, **kwargs):
        for cls in ALL_BACKENDS:
            try:
                instance = cls(**{k: v for k, v in kwargs.items() if hasattr(cls, k)})
                available = await instance.check_available()
                if available:
                    self.backends.append(instance)
                    logger.info(f"Backend available: {instance.name}")
                else:
                    logger.debug(f"Backend not available: {instance.name}")
            except Exception as e:
                logger.debug(f"Backend init failed: {cls.__name__}: {e}")
        self.backends.sort(key=lambda b: b.priority)
        logger.info(f"Total backends ready: {len(self.backends)}/{len(ALL_BACKENDS)}")

    async def extract(self, url: str, screenshot: bool = False, full_page: bool = True, proxy: Optional[dict] = None, captcha_token: Optional[str] = None) -> ScrapeResult:
        if not self.backends:
            await self.init_backends()

        results = []
        for backend in self.backends:
            try:
                kwargs = {"screenshot": screenshot, "full_page": full_page}
                if proxy:
                    kwargs["proxy"] = proxy
                if captcha_token:
                    kwargs["captcha_token"] = captcha_token
                result = await backend.scrape(url, **kwargs)
                if result:
                    result = self._run_extractors(result)
                    results.append(result)
                    logger.info(f"Backend {backend.name} succeeded (score: {result.quality_score:.0f})")
            except Exception as e:
                logger.debug(f"Backend {backend.name} failed: {e}")

        for processor in self.processors:
            results = processor.process(results)

        if results:
            best = results[0]
            best.source = f"{best.source} (+{len(results)-1} fallbacks)"
            logger.info(f"Best result from {best.source} with score {best.quality_score:.0f}")
            return best

        return ScrapeResult(url=url, source="none")

    def _run_extractors(self, result: ScrapeResult) -> ScrapeResult:
        for extractor in self.extractors:
            try:
                result = extractor.extract(result.html or "", result)
            except Exception:
                continue
        return result
