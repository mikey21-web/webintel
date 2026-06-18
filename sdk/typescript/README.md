# WebIntel SDK

```bash
npm install webintel
```

## Usage

```typescript
import { WebIntel } from 'webintel';

const wi = new WebIntel({ apiKey: 'wi_...' });

// Scrape a page
const page = await wi.scrape('https://example.com');

// Extract structured data
const data = await wi.extract('https://example.com', {
  properties: {
    name: { type: 'string' },
    price: { type: 'number' },
  }
});

// Brand intelligence
const brand = await wi.brandProfile('example.com');

// Logo CDN (no API key needed in HTML)
// <img src="https://api.webintel.dev/v1/logo/example.com" />
```

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| scrape() | POST /v1/web/scrape/markdown | Scrape URL to markdown |
| extract() | POST /v1/web/extract | AI extraction with JSON Schema |
| crawl() | POST /v1/web/crawl | Crawl entire domain |
| search() | POST /v1/web/search | Web search |
| brandProfile() | GET /v1/brand/profile | Full brand intelligence |
| brandLogo() | GET /v1/brand/logo | Brand logo URL |
| brandColors() | GET /v1/brand/colors | Brand color palette |
| brandFonts() | GET /v1/brand/fonts | Brand fonts |
| brandSocials() | GET /v1/brand/socials | Social media links |
| brandTechStack() | GET /v1/brand/techstack | Technology stack |
| classify() | GET /v1/brand/classify | Industry classification |
