#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import chalk from "chalk";
import "dotenv/config";
import * as http from "http";

const API_BASE = process.env.WEBINTEL_API_URL || "http://localhost:3456";

const toolDocs = {
  webintel_search_docs: {
    name: "webintel_search_docs",
    description: "Search WebIntel documentation for API capabilities, endpoint details, and usage guidance",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query for finding relevant documentation",
        },
      },
      required: ["query"],
    },
  },
  webintel_execute: {
    name: "webintel_execute",
    description: "Execute WebIntel API actions — scrape, extract, crawl, brand intelligence, search, health check",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "API action to perform",
          enum: ["scrape", "extract", "crawl", "brand", "search", "health"],
        },
        params: {
          type: "object",
          description: "Parameters for the action",
        },
        apiKey: {
          type: "string",
          description: "WebIntel API key (optional — sets Authorization: Bearer header)",
        },
      },
      required: ["action"],
    },
  },
};

const docsKnowledgeBase = [
  {
    id: "overview",
    title: "WebIntel Overview",
    content: `WebIntel is a web intelligence API that provides scraping, brand intelligence, and competitive analysis capabilities.

Base URL: ${API_BASE}
Authentication: Bearer token via X-API-Key header or Authorization: Bearer header.

Endpoints are grouped into:
- /v1/web/* — Web scraping, crawling, extraction
- /v1/brand/* — Brand intelligence (logos, colors, fonts, tech stack, socials)
- /v1/intel/* — Competitive intelligence (competitor analysis, market mapping, lead gen)
- /v1/reports/* — Report generation
- /v1/auth/* — API key management`,
  },
  {
    id: "scrape",
    title: "Web Scraping",
    content: `SCRAPE ENDPOINTS:

POST ${API_BASE}/v1/web/scrape/markdown
  Body: { url: string, waitFor?: number, useJs?: boolean, stealth?: boolean }
  Returns: { markdown: string, metadata: object, source: string }
  Credits: 5

POST ${API_BASE}/v1/web/scrape/html
  Body: { url: string, waitFor?: number, useJs?: boolean, stealth?: boolean }
  Returns: { html: string, metadata: object, source: string }
  Credits: 5

POST ${API_BASE}/v1/web/screenshot
  Body: { url: string, fullPage?: boolean, waitFor?: number }
  Returns: { screenshotUrl: string, metadata: object }
  Credits: 8

POST ${API_BASE}/v1/web/sitemap
  Body: { url: string }
  Returns: { urls: string[], count: number, source: string }
  Credits: 10

Options:
- useJs: render JavaScript (slower but captures dynamic content)
- stealth: evade bot detection
- waitFor: ms to wait for page load`,
  },
  {
    id: "extract",
    title: "Structured Data Extraction",
    content: `EXTRACTION ENDPOINTS:

POST ${API_BASE}/v1/web/extract
  Body: { url: string, prompt?: string }
  Returns: { url: string, extracted: object, metadata: object }
  Credits: 15
  Description: Scrapes a page then uses AI to extract structured data based on prompt.
    Default extraction: company name, description, email, phone, social links, pricing, key features.

POST ${API_BASE}/v1/web/query
  Body: { url: string, question: string }
  Returns: { url: string, question: string, answer: string, metadata: object }
  Credits: 3
  Description: Ask a specific question about a page's content.`,
  },
  {
    id: "crawl",
    title: "Web Crawling",
    content: `CRAWL ENDPOINTS:

POST ${API_BASE}/v1/web/crawl
  Body: { url: string, maxPages?: number, webhookUrl?: string, wait?: boolean }
  Returns: { jobId: string, status: "queued" }
  Credits: 25
  Description: Enqueues a crawl job. Crawls up to maxPages (default 10).
    Uses async job queue — returns immediately with jobId.
    Use GET /v1/web/crawl/:jobId to poll status.
    Optionally set wait: true to block (not yet supported).
    Optionally set webhookUrl to get a callback when done.

GET ${API_BASE}/v1/web/crawl/:jobId
  Returns: { jobId, status, url, pagesCrawled, error, result, createdAt, completedAt }`,
  },
  {
    id: "brand",
    title: "Brand Intelligence",
    content: `BRAND INTELLIGENCE ENDPOINTS:

GET ${API_BASE}/v1/brand/profile?domain=<domain>
  Returns: { domain, brandName, logoUrl, description, industry, data }
  Credits: Varies by plan

GET ${API_BASE}/v1/brand/logo?domain=<domain>
  Returns: { domain, logoUrl, details }

GET ${API_BASE}/v1/brand/colors?domain=<domain>
  Returns: { domain, primary, palette }

GET ${API_BASE}/v1/brand/fonts?domain=<domain>
  Returns: { domain, fonts }

GET ${API_BASE}/v1/brand/styleguide?domain=<domain>
  Returns: { domain, primary, palette, styleguide }

GET ${API_BASE}/v1/brand/socials?domain=<domain>
  Returns: { domain, socials }

GET ${API_BASE}/v1/brand/address?domain=<domain>
  Returns: { domain, address, city, state, pincode }

GET ${API_BASE}/v1/brand/techstack?domain=<domain>
  Returns: { domain, techstack }

GET ${API_BASE}/v1/brand/whatsapp-theme?domain=<domain>
  Returns: { domain, theme }

POST ${API_BASE}/v1/brand/transaction
  Body: { descriptor: string }
  Returns: { descriptor, brandName, domain, confidence }
  Description: Identifies merchant/brand from a bank transaction descriptor string.`,
  },
  {
    id: "intel",
    title: "Competitive Intelligence",
    content: `COMPETITIVE INTELLIGENCE ENDPOINTS (async via job queue):

All endpoints return { jobId: string } by default.
Set wait: true to poll until complete (45s timeout).

POST ${API_BASE}/v1/intel/competitor
  Body: { domain: string, depth?: 1-3, wait?: bool, webhookUrl?: string }
  Credits: 50
  Description: Analyze competitors for a given domain.

POST ${API_BASE}/v1/intel/market-map
  Body: { keyword: string, location?: string, limit?: number, wait?: bool, webhookUrl?: string }
  Credits: 50
  Description: Map the competitive landscape for a keyword.

POST ${API_BASE}/v1/intel/lead
  Body: { domains: string[], context?: string, wait?: bool, webhookUrl?: string }
  Credits: 20
  Description: Generate lead intelligence for up to 10 domains.

POST ${API_BASE}/v1/intel/sales-brief
  Body: { targetDomain: string, yourProduct: string, yourDomain: string, wait?: bool, webhookUrl?: string }
  Credits: 50
  Description: Generate a sales brief comparing your product to a target.

POST ${API_BASE}/v1/intel/pricing
  Body: { domain: string, wait?: bool, webhookUrl?: string }
  Credits: 30
  Description: Extract pricing intelligence for a domain.

POST ${API_BASE}/v1/intel/tech-stack
  Body: { domain: string, wait?: bool, webhookUrl?: string }
  Credits: 20
  Description: Detect technology stack used by a domain.

POST ${API_BASE}/v1/intel/compare
  Body: { domains: string[], wait?: bool, webhookUrl?: string }
  Credits: 20
  Description: Compare multiple domains side by side.

GET ${API_BASE}/v1/intel/:jobId
  Returns: Full job status and result.

GET ${API_BASE}/v1/intel/history
  Returns: Last 50 intel jobs for the API key.`,
  },
  {
    id: "health",
    title: "Health Check",
    content: `HEALTH ENDPOINT:

GET ${API_BASE}/health
  Returns: { status: "ok", ts: number }
  No authentication required.`,
  },
];

function searchDocs(query) {
  const q = query.toLowerCase();
  const results = docsKnowledgeBase
    .filter((doc) => doc.title.toLowerCase().includes(q) || doc.content.toLowerCase().includes(q))
    .map((doc) => ({
      id: doc.id,
      title: doc.title,
      snippet: doc.content.slice(0, 500) + (doc.content.length > 500 ? "..." : ""),
    }));
  return results.length > 0
    ? results
    : [{ id: "none", title: "No results", snippet: `No docs found matching "${query}". Try: overview, scrape, extract, crawl, brand, intel, health` }];
}

async function callAPI(action, params, apiKey) {
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const routes = {
    scrape: () => {
      const { url, waitFor, useJs, stealth } = params;
      if (!url) throw new Error("params.url is required for scrape");
      return fetch(`${API_BASE}/v1/web/scrape/markdown`, {
        method: "POST",
        headers,
        body: JSON.stringify({ url, waitFor, useJs, stealth }),
      });
    },
    extract: () => {
      const { url, prompt } = params;
      if (!url) throw new Error("params.url is required for extract");
      return fetch(`${API_BASE}/v1/web/extract`, {
        method: "POST",
        headers,
        body: JSON.stringify({ url, prompt }),
      });
    },
    crawl: () => {
      const { url, maxPages, webhookUrl, wait } = params;
      if (!url) throw new Error("params.url is required for crawl");
      return fetch(`${API_BASE}/v1/web/crawl`, {
        method: "POST",
        headers,
        body: JSON.stringify({ url, maxPages, webhookUrl, wait }),
      });
    },
    brand: () => {
      const { domain, endpoint } = params;
      if (!domain) throw new Error("params.domain is required for brand");
      const ep = endpoint || "profile";
      return fetch(`${API_BASE}/v1/brand/${ep}?domain=${encodeURIComponent(domain)}`, { headers });
    },
    search: () => {
      const { query, numResults } = params;
      if (!query) throw new Error("params.query is required for search");
      return fetch(`${API_BASE}/v1/web/query`, {
        method: "POST",
        headers,
        body: JSON.stringify({ url: `https://www.google.com/search?q=${encodeURIComponent(query)}`, question: `Return the top ${numResults || 10} search results with title, snippet, and URL` }),
      });
    },
    health: () => fetch(`${API_BASE}/health`, { headers }),
  };

  const handler = routes[action];
  if (!handler) throw new Error(`Unknown action: ${action}`);

  const response = await handler();
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`API error (${response.status}): ${data.error || JSON.stringify(data)}`);
  }

  return data;
}

function formatResult(action, data) {
  if (action === "health") {
    return `## WebIntel Health\n\n- **Status:** ${data.status}\n- **Timestamp:** ${new Date(data.ts).toISOString()}`;
  }
  return JSON.stringify(data, null, 2);
}

async function handleToolCall(name, args, apiKey) {
  try {
    if (name === "webintel_search_docs") {
      const query = args?.query;
      if (!query) {
        return { content: [{ type: "text", text: "Missing required parameter: query" }], isError: true };
      }
      const results = searchDocs(query);
      const formatted = results.map((r) => `### ${r.title}\n\n${r.snippet}`).join("\n\n---\n\n");
      return { content: [{ type: "text", text: formatted || "No documentation found." }] };
    }

    if (name === "webintel_execute") {
      const action = args?.action;
      const params = args?.params || {};
      const effectiveKey = args?.apiKey || apiKey;

      if (!action) {
        return { content: [{ type: "text", text: "Missing required parameter: action" }], isError: true };
      }

      const data = await callAPI(action, params, effectiveKey);
      const formatted = formatResult(action, data);
      return { content: [{ type: "text", text: formatted }] };
    }

    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
  }
}

const server = new Server(
  { name: "webintel-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: Object.values(toolDocs),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  return handleToolCall(name, args);
});

async function main() {
  const transportType = process.env.MCP_TRANSPORT || "stdio";
  const port = parseInt(process.env.MCP_PORT || "3001", 10);

  if (transportType === "http") {
    const requestHandler = (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-context-dev-api-key");

      if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
      }

      const authKey = req.headers["x-context-dev-api-key"] ||
        (req.headers["authorization"]?.startsWith("Bearer ") ? req.headers["authorization"].slice(7) : null);

      if (req.method === "POST" && req.url === "/mcp") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", async () => {
          try {
            const { action, params, apiKey } = JSON.parse(body);
            const effectiveKey = apiKey || authKey || process.env.CONTEXT_DEV_API_KEY;

            if (action === "list_tools") {
              res.writeHead(200, { "Content-Type": "application/json" });
              return res.end(JSON.stringify({ tools: Object.values(toolDocs) }));
            }

            if (action === "call_tool") {
              const { name, arguments: args } = params || {};
              const result = await handleToolCall(name, args, effectiveKey);
              res.writeHead(200, { "Content-Type": "application/json" });
              return res.end(JSON.stringify(result));
            }

            if (action === "search_docs") {
              const query = params?.query;
              if (!query) {
                res.writeHead(400, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ error: "query is required" }));
              }
              const results = searchDocs(query);
              res.writeHead(200, { "Content-Type": "application/json" });
              return res.end(JSON.stringify({ results }));
            }

            if (action === "execute") {
              const toolAction = params?.action;
              const toolParams = params?.params || {};
              const toolKey = params?.apiKey || effectiveKey;
              try {
                const data = await callAPI(toolAction, toolParams, toolKey);
                const formatted = formatResult(toolAction, data);
                res.writeHead(200, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ result: data, formatted }));
              } catch (err) {
                res.writeHead(500, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ error: err.message }));
              }
            }

            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Unknown action. Supported: list_tools, call_tool, search_docs, execute" }));
          } catch (err) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }

      if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ status: "ok", server: "webintel-mcp", transport: "http" }));
      }

      if (req.method === "GET" && req.url === "/") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({
          name: "webintel-mcp",
          version: "1.0.0",
          tools: Object.keys(toolDocs),
          auth: "x-context-dev-api-key header or Bearer token",
          endpoints: {
            "POST /mcp": "MCP tool call { action, params, apiKey? }",
            "GET /": "This info",
            "GET /health": "Health check",
          },
        }));
      }

      res.writeHead(404);
      res.end("Not found");
    };

    const server_ = http.createServer(requestHandler);
    await new Promise((resolve) => server_.listen(port, "0.0.0.0", resolve));
    console.error(chalk.green(`✓ WebIntel MCP server running on HTTP :${port}`));
    console.error(chalk.dim(`  POST http://localhost:${port}/mcp { action: "search_docs"|"execute", params: {...} }`));
    console.error(chalk.dim(`  Auth: x-context-dev-api-key header or {"apiKey": "wi_..."} in body`));
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(chalk.green("✓ WebIntel MCP server running on stdio"));
  }
}

main().catch((err) => {
  console.error(chalk.red("✗ Fatal error:"), err);
  process.exit(1);
});
