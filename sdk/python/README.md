# WebIntel Python SDK

Python client for the [WebIntel API](https://webintel.dev) — domain intelligence, web scraping, and brand data.

## Installation

```bash
pip install webintel
```

## Quick Start

```python
from webintel import WebIntel

client = WebIntel(api_key="your-api-key")

# Scrape a page as markdown
result = client.scrape("https://example.com")

# Extract structured data
data = client.extract("https://example.com", prompt="Get the page title")

# Get brand intelligence
profile = client.brand_profile("example.com")
colors = client.brand_colors("example.com")

# Search the web
results = client.search("WebIntel API")
```

## Methods

| Method | Endpoint | Description |
|---|---|---|
| `scrape(url, use_js, wait_for)` | `POST /v1/web/scrape/markdown` | Scrape page content as markdown |
| `scrape_html(url)` | `POST /v1/web/scrape/html` | Scrape raw HTML |
| `extract(url, schema, prompt)` | `POST /v1/web/extract` | Extract structured data via LLM |
| `crawl(url, max_pages, webhook_url)` | `POST /v1/web/crawl` | Start a crawl job |
| `get_crawl_job(job_id)` | `GET /v1/web/crawl/{job_id}` | Get crawl job status & results |
| `search(query, num_results)` | `POST /v1/web/search` | Web search |
| `query(url, question)` | `POST /v1/web/query` | Ask a question about a page |
| `brand_profile(domain)` | `GET /v1/brand/profile` | Company profile data |
| `brand_logo(domain)` | `GET /v1/brand/logo` | Logo metadata |
| `brand_colors(domain)` | `GET /v1/brand/colors` | Brand color palette |
| `brand_fonts(domain)` | `GET /v1/brand/fonts` | Brand fonts |
| `brand_socials(domain)` | `GET /v1/brand/socials` | Social media links |
| `brand_tech_stack(domain)` | `GET /v1/brand/techstack` | Technology stack |
| `brand_styleguide(domain)` | `GET /v1/brand/styleguide` | Style guide data |
| `brand_address(domain)` | `GET /v1/brand/address` | Business address |
| `classify(domain)` | `GET /v1/brand/classify` | Business classification |
| `logo_url(domain)` | — | CDN logo URL string |
| `health()` | `GET /health` | API health check |
