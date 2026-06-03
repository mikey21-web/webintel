from ..base import BaseExtractor, ScrapeResult


class ReadabilityExtractor(BaseExtractor):
    name = "readability"

    def extract(self, html: str, result: ScrapeResult) -> ScrapeResult:
        if not html:
            return result
        try:
            from readability import Document
            doc = Document(html)
            summary = doc.summary()
            result.text = result.text or doc.summary(html_partial=True)
            result.title = result.title or doc.title()
            if not result.author:
                import re
                match = re.search(r'<meta[^>]+name="?author"?[^>]+content="?([^">]+)', html)
                if match:
                    result.author = match.group(1)
            if not result.published_date:
                import re
                for pattern in [
                    r'<meta[^>]+property="?article:published_time"?[^>]+content="?([^">]+)',
                    r'<meta[^>]+name="?date"?[^>]+content="?([^">]+)',
                    r'<time[^>]+datetime="?([^">]+)',
                ]:
                    match = re.search(pattern, html)
                    if match:
                        result.published_date = match.group(1)
                        break
        except Exception:
            pass
        return result


class NewspaperExtractor(BaseExtractor):
    name = "newspaper3k"

    def extract(self, html: str, result: ScrapeResult) -> ScrapeResult:
        if not html:
            return result
        try:
            from newspaper import Article
            article = Article(result.url)
            article.set_html(html)
            article.parse()
            if article.title and not result.title:
                result.title = article.title
            if article.text and not result.text:
                result.text = article.text
            if article.authors and not result.author:
                result.author = ", ".join(article.authors)
            if article.publish_date and not result.published_date:
                result.published_date = article.publish_date.isoformat()
            if article.top_image and not result.og_image:
                result.og_image = article.top_image
        except Exception:
            pass
        return result
