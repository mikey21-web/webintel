import time
from typing import Any, Optional

import httpx


class WebIntel:
    def __init__(self, api_key: str, base_url: str = "https://api.webintel.dev"):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self._client = httpx.Client(timeout=httpx.Timeout(30.0))

    def _request(self, method: str, path: str, body: Any = None) -> Any:
        url = f"{self.base_url}{path}"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": "webintel-python-sdk/0.1.0",
        }
        kwargs = {"headers": headers}
        if body is not None:
            kwargs["json"] = body
        retryable = {429, 502, 503, 504}
        for attempt in range(3):
            response = self._client.request(method, url, **kwargs)
            if response.status_code in retryable and attempt < 2:
                time.sleep(2 ** attempt)
                continue
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                detail = ""
                try:
                    detail = exc.response.json()
                except Exception:
                    detail = exc.response.text
                raise RuntimeError(f"WebIntel API error {exc.response.status_code}: {detail}") from exc
            return response.json()

    def scrape(
        self,
        url: str,
        use_js: Optional[bool] = None,
        wait_for: Optional[str] = None,
    ) -> Any:
        body: dict[str, Any] = {"url": url}
        if use_js is not None:
            body["use_js"] = use_js
        if wait_for is not None:
            body["wait_for"] = wait_for
        return self._request("POST", "/v1/web/scrape/markdown", body=body)

    def scrape_html(self, url: str) -> Any:
        return self._request("POST", "/v1/web/scrape/html", body={"url": url})

    def extract(
        self,
        url: str,
        schema: Optional[dict] = None,
        prompt: Optional[str] = None,
    ) -> Any:
        body: dict[str, Any] = {"url": url}
        if schema is not None:
            body["schema"] = schema
        if prompt is not None:
            body["prompt"] = prompt
        return self._request("POST", "/v1/web/extract", body=body)

    def crawl(
        self,
        url: str,
        max_pages: Optional[int] = None,
        webhook_url: Optional[str] = None,
    ) -> Any:
        body: dict[str, Any] = {"url": url}
        if max_pages is not None:
            body["max_pages"] = max_pages
        if webhook_url is not None:
            body["webhook_url"] = webhook_url
        return self._request("POST", "/v1/web/crawl", body=body)

    def get_crawl_job(self, job_id: str) -> Any:
        return self._request("GET", f"/v1/web/crawl/{job_id}")

    def search(self, query: str, num_results: Optional[int] = None) -> Any:
        body: dict[str, Any] = {"query": query}
        if num_results is not None:
            body["num_results"] = num_results
        return self._request("POST", "/v1/web/search", body=body)

    def query(self, url: str, question: str) -> Any:
        return self._request("POST", "/v1/web/query", body={"url": url, "question": question})

    def brand_profile(self, domain: str) -> Any:
        return self._request("GET", f"/v1/brand/profile?domain={domain}")

    def brand_logo(self, domain: str) -> Any:
        return self._request("GET", f"/v1/brand/logo?domain={domain}")

    def brand_colors(self, domain: str) -> Any:
        return self._request("GET", f"/v1/brand/colors?domain={domain}")

    def brand_fonts(self, domain: str) -> Any:
        return self._request("GET", f"/v1/brand/fonts?domain={domain}")

    def brand_socials(self, domain: str) -> Any:
        return self._request("GET", f"/v1/brand/socials?domain={domain}")

    def brand_tech_stack(self, domain: str) -> Any:
        return self._request("GET", f"/v1/brand/techstack?domain={domain}")

    def brand_styleguide(self, domain: str) -> Any:
        return self._request("GET", f"/v1/brand/styleguide?domain={domain}")

    def brand_address(self, domain: str) -> Any:
        return self._request("GET", f"/v1/brand/address?domain={domain}")

    def classify(self, domain: str) -> Any:
        return self._request("GET", f"/v1/brand/classify?domain={domain}")

    def logo_url(self, domain: str) -> str:
        return f"https://cdn.webintel.dev/logo/{domain}.png"

    def close(self) -> None:
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

    def health(self) -> Any:
        return self._request("GET", "/health")
