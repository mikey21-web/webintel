# Build Prompt — WebIntel "Trust Layer" Upgrade

> Hand this entire document to the implementing model (DeepSeek). It is a complete, self-contained build spec. Build on the EXISTING repo — do not start greenfield.

---

## 0. Role & Objective

You are a senior backend engineer extending an existing production TypeScript API called **WebIntel**. Your job is to turn it from a "me-too" web-scraping API (a clone of context.dev / Firecrawl) into a product with **one defensible differentiator no competitor ships today**:

> **Web extraction that never silently breaks, and never silently returns wrong data.**

Everything you build serves that promise. Do not add unrelated features. Optimize for correctness, reliability, and honest failure over breadth.

---

## 1. Existing Stack (build ON this — do not replace)

- **API:** Fastify 5 + TypeScript (`src/`), entry `src/index.ts`
- **DB:** PostgreSQL via Drizzle ORM (`src/db/schema.ts`, migrations in `src/db/migrations/`)
- **Queue/Cache:** Redis + BullMQ (`src/queue/`, workers in `src/queue/workers/`)
- **AI:** Dual provider — Anthropic Claude + OpenAI — wrapped in `src/ai.ts` (`askAI()`). Currently first-provider-wins fallback.
- **Scraping:** Puppeteer-core + a Python FastAPI sidecar (`python/main.py`, port 8765) using Crawl4AI. Helpers in `src/scraping/`.
- **Auth:** JWT + scoped API keys (`src/middleware/auth.ts`), credit metering (`src/middleware/credits.ts`).
- **Existing tables:** users, apiKeys, creditBalances, billingPlans, subscriptions, payments, usageLogs, brandCache, intelJobs, monitors, monitorSnapshots, monitorAlerts, reports, crawlJobs.

Run `npm run check` (typecheck + lint + test) — it must stay green after every change.

---

## 2. What to build — three systems

### SYSTEM A — Tiered Fetch / Unblock Engine (the foundation)

Nothing else matters if you can't reliably GET the page. Build a single internal `fetchPage(url, opts)` orchestrator that escalates cheap→expensive and STOPS at the first tier that returns real content.

**Tiers (escalate only on failure or soft-block detection):**
0. Plain HTTP (`undici`) — fast, free. ~75% of pages.
1. HTTP + realistic headers + datacenter proxy rotation.
2. Headless Chrome (Puppeteer/sidecar) with **stealth fingerprint** patching (`navigator.webdriver`, canvas/WebGL noise, real viewport, plugins, languages). Handles JS/SPA/lazy-load.
3. Stealth browser + **residential proxy** (provider-agnostic adapter; support IPRoyal/Bright Data via env).
4. Residential + human-like behavior (mouse/scroll/delay) + pluggable **CAPTCHA solver** adapter (2Captcha/CapSolver via env).
5. **Give up honestly** → return `{ status: "blocked", reason, tierReached }`. NEVER fabricate or return a challenge page as content.

**Critical — soft-block detection.** After every tier, validate the response is real, not a 200-OK lie:
- Detect known challenge fingerprints (Cloudflare / DataDome / PerimeterX / "enable JS" stubs).
- Flag suspiciously short / empty-shell content.
- Compare against historical content shape for that domain (see System B contracts) — sudden drift may = block.
- If invalid → escalate to next tier.

**JS rendering requirements:**
- Smart wait: wait for network-idle or a target selector, not a fixed timeout.
- Actions API: click ("load more"), scroll (lazy-load), dismiss cookie/modal walls, expand sections.
- Block images/fonts/ads for 3–5x faster, cheaper renders.

**Config knobs to expose on the public scrape/extract endpoints (gap competitors refuse to offer):**
- `proxyCountry`, `proxyType: residential|datacenter`, sticky `sessionId`, `render: auto|always|never`, `actions[]`, `maxTier`.

**Constraints:**
- Proxy/CAPTCHA/browser providers must be behind adapter interfaces with env-based config; no hard-coded vendor.
- Target: high success on the PUBLIC web. Do NOT special-case or market login/paywall/LinkedIn scraping — users bring their own auth for gated content. Respect robots.txt by default with an explicit override flag.

### SYSTEM B — Self-Healing Extraction Contracts (the differentiator)

An extraction is not a one-shot — it's a **living contract with memory.**

**New table `extraction_contracts`** (Drizzle): `id`, `userId`, `url` (or url pattern), `schema` (JSON: fields+types), `semanticAnchors` (per field: how the data was located, e.g. "price appears near 'per month'"), `valueFingerprint` (per field: type, regex, numeric range, expected list-length band, sample values), `provenance` history, `lastHealedAt`, `createdAt`, `updatedAt`. Plus `extraction_runs` for history/audit.

**Flow:**
1. **Capture** — on first successful extraction, store schema + semantic anchors + value-shape fingerprint + provenance (source url, content hash, timestamp, literal source snippet per field).
2. **Validate** — on every subsequent run, BEFORE returning, check new values against the fingerprint: required present? numeric in expected range (not suddenly 0/null)? list length in band? regex match?
3. **Heal** — if validation fails / confidence drops, re-extract in **"rediscover" mode**: the LLM ignores stale anchors and finds data by INTENT ("locate the monthly price"), updates the contract, emits a `schema.healed` event with before/after diff. Pipeline keeps working through the site change.
4. **Confidence per field** — derive from: (a) anchor/selector stability vs history, (b) **dual-LLM agreement** (run both Claude + GPT; agree = high, disagree = flag), (c) value-shape conformance. Must be calibrated against a golden set — NOT raw LLM self-reported confidence.
5. **Never lie** — if confidence is low and healing can't recover, return the field as `status: "needs_review"` with a reason. Never a confident wrong answer.

**Response envelope (every extracted field):**
```jsonc
{
  "price": {
    "value": 49,
    "confidence": 0.98,
    "status": "ok",                 // ok | needs_review | healed | blocked
    "source_url": "https://acme.com/pricing",
    "source_snippet": "Pro — $49 / month",
    "extracted_at": "2026-...",
    "content_hash": "sha256:...",
    "healed": false
  },
  "_contract": { "drift_detected": false, "healed_fields": [] }
}
```

### SYSTEM C — Rework `src/ai.ts` into a confidence/agreement engine

- Add `extractWithConfidence(schema, content)` that runs BOTH providers, parses each through the Zod schema, compares field-by-field, and returns values + per-field agreement/confidence.
- Keep the existing `askAI` fallback for non-extraction calls.
- Add schema-repair: if a provider returns invalid JSON/shape, retry once with the validation error fed back, then mark `needs_review` if still bad.
- Add a `prompt-only` extract mode (natural language: "extract all pricing tiers" — no explicit schema), matching Firecrawl's Agent mode but with the confidence envelope.

---

## 3. Secondary gap-fillers (only after A/B/C are solid)

- **Scheduled extraction + change history as a product** — recurring scrapes with stored history (reuse monitors/monitorSnapshots), webhook on `value.changed` / `schema.healed`. Firecrawl is stateless; this is your edge.
- **Structured SERP endpoint** — return People-Also-Ask, featured snippets, knowledge graph, local pack as separate typed objects (not just url/title/desc).
- **Document parsing** — PDF/DOCX → clean markdown.
- **Managed browser session** — hand agents a CDP WebSocket URL for live interaction.

---

## 4. Hard requirements / acceptance criteria

1. `npm run check` stays green (typecheck + lint + tests).
2. **Tests are mandatory** for: tier escalation logic, soft-block detection, contract capture/validate/heal, dual-LLM agreement scoring, the response envelope. Use Vitest. Mock external HTTP/LLM/proxy calls.
3. **Golden-set calibration harness** — a fixture set of ~20 real pages with expected extraction output; confidence scores must be validated against it, not invented. CI runs it.
4. Credit metering: each tier and heal has a defined cost; charging is idempotent (a retried/healed job must not double-charge). Add a test proving no double-spend under concurrent requests.
5. All vendor integrations behind adapter interfaces + env config. No secrets in code.
6. Honest failure everywhere: blocked/uncertain → explicit status, never fabricated data or fake confidence.
7. Update `.env.example`, add migrations, document new endpoints.

---

## 5. Build order (phased — ship each phase green before the next)

1. **Phase 1:** System C (dual-LLM confidence engine + golden-set harness). Smallest, highest signal — provenance + confidence on every field already beats every competitor.
2. **Phase 2:** System B (extraction_contracts: capture → validate → heal + envelope).
3. **Phase 3:** System A (tiered fetch/unblock + soft-block detection + proxy/session knobs).
4. **Phase 4:** Secondary gap-fillers.

For each phase: list files changed, new tables/migrations, new endpoints, and the tests added. Keep diffs reviewable.

---

## 6. Non-goals / guardrails

- Do NOT market or special-case login/paywall/LinkedIn scraping (legal exposure).
- Do NOT chase "100% success / never any error" — target 90%+ on the public web and fail honestly on the rest.
- Do NOT add open-source/self-host plumbing (hosted product only).
- Do NOT bloat with unrelated features. Every line serves "never silently break, never silently lie."

---

## 7. Output format for your work

For each phase, deliver: (1) a short plan, (2) the code, (3) migrations, (4) tests, (5) a one-paragraph summary of what changed and how to verify. Then stop for review before the next phase.
