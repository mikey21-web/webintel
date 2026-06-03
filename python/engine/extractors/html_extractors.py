from ..base import BaseExtractor, ScrapeResult


class SelectolaxExtractor(BaseExtractor):
    name = "selectolax"

    def extract(self, html: str, result: ScrapeResult) -> ScrapeResult:
        if not html:
            return result
        from selectolax.parser import HTMLParser
        try:
            tree = HTMLParser(html)
            if not result.title:
                title_tag = tree.css_first("title")
                if title_tag:
                    result.title = title_tag.text(strip=True)
            if not result.description:
                for tag in tree.css("meta"):
                    name = tag.attributes.get("name", "") or tag.attributes.get("property", "")
                    content = tag.attributes.get("content", "")
                    if name.lower() in ("description", "og:description"):
                        result.description = content or result.description
                    if name.lower() in ("og:image", "twitter:image"):
                        result.og_image = content or result.og_image
                    if name.lower() == "og:site_name":
                        result.site_name = content or result.site_name
                    if name.lower() == "author":
                        result.author = content or result.author
            internal = []
            external = []
            for a in tree.css("a[href]"):
                href = a.attributes.get("href", "")
                if href.startswith("/") or href.startswith("#"):
                    continue
                if "://" not in href:
                    continue
                if result.url.split("/")[2] in href:
                    internal.append(href)
                else:
                    external.append(href)
            result.links_internal = internal[:20]
            result.links_external = external[:20]
        except Exception:
            pass
        return result


class ParselExtractor(BaseExtractor):
    name = "parsel"

    def extract(self, html: str, result: ScrapeResult) -> ScrapeResult:
        if not html:
            return result
        try:
            from parsel import Selector
            sel = Selector(text=html)
            if not result.title:
                result.title = sel.css("title::text").get("")
            if not result.description:
                result.description = sel.css(
                    "meta[name=description]::attr(content), "
                    "meta[property='og:description']::attr(content)"
                ).get("")
            text_nodes = sel.css("p::text, h1::text, h2::text, h3::text, li::text").getall()
            combined = " ".join(t.strip() for t in text_nodes if t.strip())
            if combined:
                result.text = combined
        except Exception:
            pass
        return result


class TrafilaturaExtractor(BaseExtractor):
    name = "trafilatura"

    def extract(self, html: str, result: ScrapeResult) -> ScrapeResult:
        if not html:
            return result
        import trafilatura
        try:
            extracted = trafilatura.extract(
                html,
                output_format="markdown",
                include_links=True,
                include_images=True,
                include_tables=True,
            )
            if extracted:
                result.markdown = result.markdown or extracted
            text = trafilatura.extract(html, include_links=False, include_images=False)
            if text:
                result.text = result.text or text
        except Exception:
            pass
        return result
