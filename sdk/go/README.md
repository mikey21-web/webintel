# WebIntel Go SDK

Go client library for the [WebIntel API](https://webintel.dev).

## Install

```bash
go get github.com/webintel/webintel-go
```

## Quick Start

```go
package main

import (
	"fmt"
	"log"
	"github.com/webintel/webintel-go"
)

func main() {
	client := webintel.NewClient(webintel.WithAPIKey("your-api-key"))

	result, err := client.Scrape("https://example.com")
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(result.Markdown[:200])
}
```

## Methods

| Method | Endpoint |
|--------|----------|
| `Scrape(url, opts...)` | `POST /v1/web/scrape/markdown` |
| `ScrapeHTML(url)` | `POST /v1/web/scrape/html` |
| `Extract(url, schema)` | `POST /v1/web/extract` |
| `Crawl(url, maxPages)` | `POST /v1/web/crawl` |
| `GetCrawlJob(jobID)` | `GET /v1/web/crawl/{id}` |
| `Search(query, numResults)` | `POST /v1/web/search` |
| `Query(url, question)` | `POST /v1/web/query` |
| `BrandProfile(domain)` | `GET /v1/brand/profile` |
| `BrandLogo(domain)` | `GET /v1/brand/logo` |
| `BrandColors(domain)` | `GET /v1/brand/colors` |
| `BrandFonts(domain)` | `GET /v1/brand/fonts` |
| `BrandSocials(domain)` | `GET /v1/brand/socials` |
| `BrandTechStack(domain)` | `GET /v1/brand/techstack` |
| `BrandStyleguide(domain)` | `GET /v1/brand/styleguide` |
| `BrandAddress(domain)` | `GET /v1/brand/address` |
| `Classify(domain)` | `GET /v1/brand/classify` |
| `LogoURL(domain)` | CDN URL helper |
| `Health()` | `GET /health` |

## Options

```go
useJs := true
waitFor := 3000
stealth := true

result, err := client.Scrape("https://example.com",
	func(o *webintel.ScrapeOptions) { o.UseJs = &useJs },
	func(o *webintel.ScrapeOptions) { o.WaitFor = &waitFor },
	func(o *webintel.ScrapeOptions) { o.Stealth = &stealth },
)
```
