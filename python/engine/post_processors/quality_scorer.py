from typing import Optional
from ..base import BaseProcessor, ScrapeResult


class QualityScorer(BaseProcessor):
    name = "quality-scorer"

    def process(self, results: list[ScrapeResult]) -> list[ScrapeResult]:
        for result in results:
            score = 0.0
            if result.html:
                score += 10
            if result.markdown:
                score += 15
            if result.text:
                score += 15
            if result.title:
                score += 10
            if result.description:
                score += 10
            if result.og_image:
                score += 5
            if result.json_ld:
                score += 10
            if result.open_graph:
                score += 5
            if result.links_internal or result.links_external:
                score += 5
            if result.prices:
                score += 5
            if result.screenshot_base64:
                score += 5
            html_len = len(result.html or "")
            if 1000 < html_len < 500000:
                score += 5
            elif html_len >= 500000:
                score += 3
            if result.author or result.published_date:
                score += 5
            result.quality_score = score
        return sorted(results, key=lambda r: r.quality_score, reverse=True)


class ResultAggregator(BaseProcessor):
    name = "aggregator"

    def process(self, results: list[ScrapeResult]) -> list[ScrapeResult]:
        if not results:
            return results
        results = [r for r in results if r.source != "none" and r.html]
        scored = QualityScorer().process(results)
        return scored
