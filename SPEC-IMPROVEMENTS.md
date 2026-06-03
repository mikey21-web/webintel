# WebIntel Spec — 10/10 Improvements
## Changes that make Context.dev irrelevant

---

### Critical Additions

**1. Synchronous Mode (this is the #1 reason people won't use async-only)**
```typescript
// All intel endpoints accept ?wait=true
// If wait=true, hold connection up to 45s, poll internally, return result directly
// If wait=false (default), return jobId as before (async)
// Context.dev is sync. You must be too.
```

**2. Webhook Callback (zero-config integration)**
```typescript
// Every intel job accepts optional webhookUrl
// On completion: POST result to webhookUrl with HMAC-SHA256 signature header
// Retry: 3 times with exponential backoff (5s, 25s, 125s)
// Enables: n8n, Zapier, Make, Pabbly without polling
```

**3. Chrome Extension (unlocks virality)**
```
- Right-click any domain → "Get WebIntel"
- Hover over links → shows brief tooltip (logo + score + one-liner)
- LinkedIn integration: shows intel on company profile pages
- Gmail/Outlook: shows intel on sender domain in email
- Freemium: 10 looks/day free, Pro unlimited
- This is how you get 1000 users in 30 days
```

**4. CLI Tool (`npx webintel-cli`)**
```bash
npx webintel-cli analyze 99acres.com              # Full competitor intel → stdout
npx webintel-cli compare 99acres.com magicbricks.com  # Side-by-side
npx webintel-cli monitor 99acres.com --interval daily # Set up monitor
npx webintel-cli export --format json              # Export all your data
# Developer-first. Context.dev has no CLI.
```

**5. Batch Intelligence (100x efficiency)**
```typescript
// POST /v1/intel/batch/competitor
{ "domains": ["99acres.com", "magicbricks.com", ...], "maxDomains": 25 }
// Returns: { "batchId": "uuid", "results": { "99acres.com": {...}, ... } }
// Process in parallel (3 concurrency), deduplicate scraping
// Cost: same as individual, but 40% cheaper via scraped-page sharing
```

**6. Comparison Engine (new module)**
```typescript
// POST /v1/intel/compare
{ "domains": ["99acres.com", "magicbricks.com", "housing.com"] }
// Returns: {
//   "comparisonMatrix": { "featureA": { "99acres": "yes", "magicbricks": "no", ... }, ... },
//   "pricingComparison": [...],
//   "marketPositioning": "string",
//   "strengthMap": { "99acres": "reach", "magicbricks": "trust", ... },
//   "recommendation": "string"
// }
// Context.dev can't compare. You can.
```

---

### Free Tier Fix

| Aspect | Before (losing) | After (winning) |
|--------|----------------|-----------------|
| Credits | 500 one-time | 1000 **monthly recurring** |
| Brand lookups | 50 total | 100/month |
| Intel jobs | 3 total | 5/month |
| Monitors | 0 | 1 URL, daily |
| Chrome ext | none | 10 looks/day |
| Webhook callbacks | none | 50/month |
| Comparison reports | none | 2/month |

**Why:** 500 one-time credits = user tries once, churns. 1000 monthly = user integrates into workflow, upgrades. The free tier is marketing, not cost center.

---

### Observability (current spec has NONE)

```typescript
// src/middleware/requestLogger.ts
// Logs every request to Supabase usage_logs + sends to Cloudflare R2 as NDJSON
// Daily summary: avg P50/P95/P99 latency, error rate by endpoint, credit burn rate

// src/monitoring/apiHealth.ts
// Cron every 5 min: health-check each worker (crawl, intel, monitor)
// If any worker fails 3 consecutive checks → send WhatsApp to admin
// If Python sidecar fails → restart via PM2, log to Slack webhook

// Grafana/Prometheus optional — ship Cloudflare R2 logs to any BI tool
// Built-in dashboard health page: /v1/admin/health
```

---

### Proxy + IP Rotation (enterprise requirement)

```python
# python/proxy.py
# Free: no proxy (direct scrape, limited to 100 req/day/domain)
# Pro+: rotating proxy from pool (webshare, smartproxy, or self-hosted)
# Scrape: 500 req/min, 5 concurrent per IP
# Enterprise: dedicated proxy IPs, static + rotating

# Add to fallback.py:
# if proxy_pool:
#     ip = await proxy_pool.get_ip()
#     request with proxy=ip
#     if fails: mark IP bad, retry from fresh IP
```

---

### Email + Phone Finder (Indian market must-have)

```typescript
// New endpoint: POST /v1/intel/enrich
// { "domain": "example.com" }
// Returns: {
//   "emails": ["founder@example.com", "hr@example.com"],
//   "phones": ["+91-9876543210"],
//   "sources": ["/contact", "/about", "/team"],
//   "confidence": { "email_found": 0.9, "phone_found": 0.8 }
// }
// Extraction: scrape /contact, /about, /team pages
// Pattern: mailto:, phone number regex, LinkedIn URLs
// Claude: validate + extract from unstructured text
```

---

### Integration Matrix (not just n8n)

| Platform | Priority | Implementation |
|----------|----------|----------------|
| n8n native node | P0 | Done (spec section 53) |
| Zapier | P0 | Webhook + REST API, approval in 2-4 weeks |
| Make (Integromat) | P0 | Webhook + REST API |
| Pabbly Connect | P0 | Webhook + REST API |
| Slack app | P1 | POST to Slack webhook on intel complete |
| Google Sheets | P1 | Export add-on |
| HubSpot CRM | P2 | Enrich contacts with intel |
| Salesforce | P2 | Enrich leads |
| Chrome Extension | P0 | Above |
| VS Code Extension | P2 | Show intel on hover over domain in code |
| GitHub Actions | P1 | `webintel/competitor-check@v1` |

---

### 22-Day Build Plan (revised from 21)

**Day 1-7:** Same (foundation + scraping)
**Day 8-11:** Brand + competitor + sales brief (same)
**Day 12:** **Synchronous mode** + **webhook callbacks** (P0)
**Day 13:** **Batch intelligence** + **comparison engine** (P0)
**Day 14:** Buffer + fix errors
**Day 15:** **CLI tool** (P0)
**Day 16:** **Chrome extension** (P0)
**Day 17:** Monitoring + reports
**Day 18:** n8n node + **Zapier/Make templates**
**Day 19-20:** Dashboard (add health page + usage alerts)
**Day 21:** **Email + phone finder** + proxy layer
**Day 22:** Buffer + full end-to-end QA

---

### What Context.dev CANNOT do (after these changes)

- Sync mode for fast integrations
- WhatsApp alerts with Evolution API
- Comparison engine (2+ companies side by side)
- Batch intelligence (25 domains at once)
- Chrome extension (hover-to-intel)
- CLI tool
- Indian email/phone/GST extraction
- White-label reports
- WhatsApp theme builder
- Self-hosted option
- Proxy rotation for enterprise scraping
- n8n native node + Zapier + Make
- INR pricing (₹999 vs $49)
- India-first coverage (1000+ Indian SMB domains tested)

**Final score: 10/10.** Build this and Context.dev is a footnote.
