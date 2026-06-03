from ..base import BaseExtractor, ScrapeResult


class ExtructExtractor(BaseExtractor):
    name = "extruct"

    def extract(self, html: str, result: ScrapeResult) -> ScrapeResult:
        if not html:
            return result
        try:
            import extruct
            from w3lib.html import get_base_url
            base_url = get_base_url(html, result.url)
            data = extruct.extract(html, base_url=base_url)
            if data.get("json-ld"):
                result.json_ld = data["json-ld"]
                for entry in data["json-ld"]:
                    if isinstance(entry, dict):
                        if entry.get("name") and not result.title:
                            result.title = entry["name"]
                        if entry.get("description") and not result.description:
                            result.description = entry["description"]
                        if entry.get("author") and not result.author:
                            if isinstance(entry["author"], dict):
                                result.author = entry["author"].get("name", "")
                            else:
                                result.author = str(entry["author"])
                        if entry.get("datePublished") and not result.published_date:
                            result.published_date = entry["datePublished"]
            if data.get("opengraph"):
                og = data["opengraph"]
                result.open_graph = og
                if og.get("og:title") and not result.title:
                    result.title = og["og:title"]
                if og.get("og:description") and not result.description:
                    result.description = og["og:description"]
                if og.get("og:image") and not result.og_image:
                    result.og_image = og["og:image"]
                if og.get("og:site_name") and not result.site_name:
                    result.site_name = og["og:site_name"]
            if data.get("twitter"):
                result.twitter_card = data["twitter"]
                tc = data["twitter"]
                if tc.get("twitter:title") and not result.title:
                    result.title = tc["twitter:title"]
                if tc.get("twitter:description") and not result.description:
                    result.description = tc["twitter:description"]
                if tc.get("twitter:image") and not result.og_image:
                    result.og_image = tc["twitter:image"]
            if data.get("microdata"):
                result.microdata = data["microdata"]
        except Exception:
            pass
        return result
