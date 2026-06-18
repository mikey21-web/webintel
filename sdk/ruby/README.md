# WebIntel Ruby SDK

Ruby client for the [WebIntel API](https://webintel.dev) — domain intelligence, web scraping, and brand data.

## Installation

Add to your Gemfile:

```ruby
gem "webintel"
```

Or install manually:

```bash
gem install webintel
```

## Usage

```ruby
require "webintel"

client = WebIntel.new("your_api_key")

# Scrape a page as markdown
result = client.scrape("https://example.com")
puts result["content"]

# Get brand profile
profile = client.brand_profile("example.com")
puts profile["name"]

# Check health
puts client.health
```

## Methods

| Method | Endpoint | Description |
|---|---|---|
| `scrape(url, use_js:, wait_for:)` | POST `/v1/web/scrape/markdown` | Scrape page to markdown |
| `scrape_html(url)` | POST `/v1/web/scrape/html` | Scrape raw HTML |
| `sitemap(url)` | POST `/v1/web/sitemap` | Get sitemap URLs |
| `screenshot(url, full_page:, wait_for:)` | POST `/v1/web/screenshot` | Take page screenshot |
| `extract(url, schema:, prompt:)` | POST `/v1/web/extract` | Extract structured data |
| `crawl(url, max_pages:, webhook_url:)` | POST `/v1/web/crawl` | Start a crawl job |
| `get_crawl_job(job_id)` | GET `/v1/web/crawl/:id` | Get crawl status |
| `search(query, num_results:)` | POST `/v1/web/search` | Web search |
| `query(url, question)` | POST `/v1/web/query` | Ask a question about a page |
| `brand_profile(domain)` | GET `/v1/brand/profile` | Brand profile |
| `brand_logo(domain)` | GET `/v1/brand/logo` | Logo URL |
| `brand_colors(domain)` | GET `/v1/brand/colors` | Brand colors |
| `brand_fonts(domain)` | GET `/v1/brand/fonts` | Brand fonts |
| `brand_socials(domain)` | GET `/v1/brand/socials` | Social links |
| `brand_tech_stack(domain)` | GET `/v1/brand/techstack` | Tech stack |
| `brand_styleguide(domain)` | GET `/v1/brand/styleguide` | Style guide |
| `brand_address(domain)` | GET `/v1/brand/address` | Address info |
| `classify(domain)` | GET `/v1/brand/classify` | Business classification |
| `logo_url(domain)` | — | Direct logo URL |
| `health` | GET `/health` | API health check |

## Requirements

Ruby >= 2.7, httparty ~> 0.21.
