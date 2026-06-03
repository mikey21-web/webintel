import re
from ..base import BaseExtractor, ScrapeResult


class PriceParserExtractor(BaseExtractor):
    name = "price-parser"

    def extract(self, html: str, result: ScrapeResult) -> ScrapeResult:
        if not html:
            return result
        try:
            from price_parser import Price
        except ImportError:
            return self._extract_fallback(html, result)
        try:
            prices = []
            for match in re.finditer(
                r'(?:₹|Rs\.?|INR|\$|€|£)\s*[\d,]+(?:\.\d{2})?',
                html
            ):
                price = Price.fromstring(match.group())
                if price and price.amount is not None:
                    prices.append({
                        "raw": match.group(),
                        "amount": float(price.amount),
                        "currency": price.currency or "INR",
                    })
            if prices:
                result.prices = prices[:10]
        except Exception:
            pass
        return result

    def _extract_fallback(self, html: str, result: ScrapeResult) -> ScrapeResult:
        try:
            prices = []
            for match in re.finditer(
                r'(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?)',
                html
            ):
                amount = match.group(1).replace(",", "")
                try:
                    prices.append({
                        "raw": match.group(0),
                        "amount": float(amount),
                        "currency": "INR",
                    })
                except ValueError:
                    continue
            if prices:
                result.prices = prices[:10]
        except Exception:
            pass
        return result
