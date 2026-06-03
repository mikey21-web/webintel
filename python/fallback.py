from engine.orchestrator import ExtractionOrchestrator

_orchestrator: ExtractionOrchestrator | None = None


async def get_orchestrator() -> ExtractionOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = ExtractionOrchestrator()
        await _orchestrator.init_backends()
    return _orchestrator


async def scrape_with_fallback(url: str, **kwargs) -> dict:
    orch = await get_orchestrator()
    result = await orch.extract(url, **kwargs)
    return result_to_dict(result)


def result_to_dict(r) -> dict:
    return {
        "markdown": r.markdown,
        "html": r.html,
        "text": r.text,
        "metadata": {
            "title": r.title,
            "description": r.description,
            "ogImage": r.og_image,
            "siteName": r.site_name,
            "author": r.author,
            "publishedDate": r.published_date,
        },
        "jsonLd": r.json_ld,
        "openGraph": r.open_graph,
        "twitterCard": r.twitter_card,
        "microdata": r.microdata,
        "links": {
            "internal": r.links_internal,
            "external": r.links_external,
        },
        "prices": r.prices,
        "screenshotBase64": r.screenshot_base64,
        "source": r.source,
        "qualityScore": r.quality_score,
        "extractedAt": r.extracted_at,
    }
