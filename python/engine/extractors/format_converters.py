from ..base import BaseExtractor, ScrapeResult


class Html2TextConverter(BaseExtractor):
    name = "html2text"

    def extract(self, html: str, result: ScrapeResult) -> ScrapeResult:
        if not html:
            return result
        try:
            import html2text
            h = html2text.HTML2Text()
            h.body_width = 0
            h.ignore_links = False
            h.ignore_images = False
            h.ignore_tables = False
            h.escape_all = False
            h.reference_links = True
            markdown = h.handle(html)
            if markdown and not result.markdown:
                result.markdown = markdown
        except Exception:
            pass
        return result


class MarkdownifyConverter(BaseExtractor):
    name = "markdownify"

    def extract(self, html: str, result: ScrapeResult) -> ScrapeResult:
        if not html:
            return result
        try:
            from markdownify import markdownify as md
            converted = md(html, heading_style="ATX", bullets="-")
            if converted and not result.markdown:
                result.markdown = converted
        except Exception:
            pass
        return result
