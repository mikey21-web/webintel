import { FastifyInstance } from 'fastify';
import { config } from '../config';
import { db } from '../db/client';
import { sql } from 'drizzle-orm';

function pageHTML(title: string, body: string, extraHead: string = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — WebIntel</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',system-ui,-apple-system,sans-serif;background:#0a0a0f;color:#e2e8f0;line-height:1.6;min-height:100vh}
.container{max-width:960px;margin:0 auto;padding:2rem 1.5rem}
header{border-bottom:1px solid #1e293b;padding:1rem 0;margin-bottom:3rem}
header .container{display:flex;align-items:center;justify-content:space-between;padding-top:0;padding-bottom:0}
header a{color:#e2e8f0;text-decoration:none;font-weight:600;font-size:1.125rem}
header a:hover{color:#818cf8}
header nav a{margin-left:1.5rem;font-size:0.875rem;font-weight:500;color:#94a3b8}
header nav a:hover{color:#e2e8f0}
h1{font-size:2rem;font-weight:800;margin-bottom:0.5rem;background:linear-gradient(135deg,#818cf8,#6366f1);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
h2{font-size:1.25rem;font-weight:600;margin:2rem 0 1rem;color:#f1f5f9}
p{color:#94a3b8;margin-bottom:1rem}
.card{background:#111118;border:1px solid #1e293b;border-radius:12px;padding:1.5rem;margin-bottom:1rem;transition:border-color 0.2s}
.card:hover{border-color:#334155}
.card h3{font-size:1rem;font-weight:600;margin-bottom:0.5rem;color:#e2e8f0}
.card p{font-size:0.875rem;margin-bottom:0}
.status-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:0.5rem}
.status-dot.operational{background:#22c55e}
.status-dot.degraded{background:#eab308}
.status-dot.down{background:#ef4444}
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin:1.5rem 0}
.stat-card{background:#111118;border:1px solid #1e293b;border-radius:12px;padding:1.25rem;text-align:center}
.stat-card .value{font-size:1.75rem;font-weight:700;color:#818cf8}
.stat-card .label{font-size:0.75rem;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-top:0.25rem}
.tag{display:inline-block;padding:0.25rem 0.75rem;border-radius:999px;font-size:0.75rem;font-weight:500;margin-right:0.5rem;margin-bottom:0.5rem}
.tag.green{background:#052e16;color:#22c55e;border:1px solid #166534}
.tag.yellow{background:#422006;color:#eab308;border:1px solid #854d0e}
.tag.blue{background:#1e1b4b;color:#818cf8;border:1px solid #3730a3}
.tag.gray{background:#1e293b;color:#94a3b8;border:1px solid #334155}
footer{border-top:1px solid #1e293b;margin-top:4rem;padding:2rem 0;text-align:center;color:#64748b;font-size:0.875rem}
footer a{color:#94a3b8;text-decoration:none}
footer a:hover{color:#e2e8f0}
.api-status{font-family:monospace;font-size:0.875rem;background:#0f0f17;padding:0.75rem 1rem;border-radius:8px;border:1px solid #1e293b;margin:1rem 0}
.trust-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1rem;margin:1.5rem 0}
.trust-card{background:#111118;border:1px solid #1e293b;border-radius:12px;padding:1.5rem;text-align:center}
.trust-card .icon{font-size:2rem;margin-bottom:0.75rem}
.trust-card h3{font-size:1rem;font-weight:600;color:#e2e8f0}
.trust-card p{font-size:0.875rem;color:#94a3b8;margin-bottom:0}
@media(max-width:640px){.container{padding:1rem}h1{font-size:1.5rem}}
</style>
${extraHead}
</head>
<body>
<header>
<div class="container">
<a href="/">WebIntel</a>
<nav>
<a href="/status">Status</a>
<a href="/changelog">Changelog</a>
<a href="/trust">Trust</a>
<a href="https://docs.webintel.dev">Docs</a>
</nav>
</div>
</header>
<div class="container">
${body}
</div>
<footer>
<div class="container">
<p>WebIntel &mdash; Web Intelligence API &bull; <a href="/status">Status</a> &bull; <a href="/changelog">Changelog</a> &bull; <a href="/trust">Trust Center</a></p>
</div>
</footer>
</body>
</html>`;
}

export async function pageRoutes(app: FastifyInstance) {
  app.get('/status', async (request, reply) => {
    reply.type('text/html');

    let apiStatus = 'operational';
    let apiLatency = 0;
    let uptimeDays = 0;

    try {
      const start = Date.now();
      await fetch(`http://localhost:${config.PORT}/health`);
      apiLatency = Date.now() - start;
    } catch {
      apiStatus = 'down';
    }

    let recentErrors = 0;
    try {
      const [result] = await db.execute(sql`
        SELECT COUNT(*) as count FROM usage_logs WHERE status >= 500 AND created_at > NOW() - INTERVAL '24 hours'
      `);
      recentErrors = parseInt((result as any).rows?.[0]?.count || '0', 10);
    } catch { /* db might not be available */ }

    if (recentErrors > 10) apiStatus = 'degraded';

    const body = `
      <h1>System Status</h1>
      <p>Current status of WebIntel API services.</p>
      
      <div class="api-status">
        <span class="status-dot ${apiStatus}"></span>
        <strong>API</strong> — ${apiStatus === 'operational' ? 'All Systems Operational' : apiStatus === 'degraded' ? 'Degraded Performance' : 'Service Disruption'}
        ${apiLatency > 0 ? `<span style="float:right;color:#64748b">${apiLatency}ms latency</span>` : ''}
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="value">${uptimeDays}d</div>
          <div class="label">Uptime</div>
        </div>
        <div class="stat-card">
          <div class="value">${recentErrors}</div>
          <div class="label">Errors (24h)</div>
        </div>
        <div class="stat-card">
          <div class="value">${apiLatency}ms</div>
          <div class="label">Avg Latency</div>
        </div>
        <div class="stat-card">
          <div class="value">${new Date().toISOString().slice(0, 10)}</div>
          <div class="label">Last Updated</div>
        </div>
      </div>

      <h2>Services</h2>
      <div class="card">
        <h3><span class="status-dot operational"></span>API Server</h3>
        <p>REST API endpoints for web scraping, brand intelligence, and extraction</p>
      </div>
      <div class="card">
        <h3><span class="status-dot operational"></span>Web Scraping</h3>
        <p>Scrape, crawl, and extraction engine</p>
      </div>
      <div class="card">
        <h3><span class="status-dot operational"></span>Dashboard</h3>
        <p>Web interface and API key management</p>
      </div>

      <h2>Incident History</h2>
      <p>No recent incidents. All systems operational.</p>
    `;

    return pageHTML('System Status', body);
  });

  app.get('/changelog', async (request, reply) => {
    reply.type('text/html');

    const entries = [
      { date: '2026-06-18', tag: 'release', title: 'Phase 2: SDKs, MCP Server, Integrations', body: 'Released TypeScript, Python, Ruby, and Go SDKs. MCP server with HTTP + stdio transport. Zapier + Make integrations. Brand lookup by name/email/ticker. NAICS/SIC classification. Product extraction. Versioned data + diff API. Streaming SSE crawl. Robots.txt compliance layer.' },
      { date: '2026-06-15', tag: 'release', title: 'Phase 1: Core WebIntel Launch', body: 'Launched WebIntel API with web scraping, crawling, brand intelligence, competitive analysis, change monitoring, and async job processing. Dashboard with real-time data, theme customization, and dark mode.' },
      { date: '2026-06-10', tag: 'update', title: 'EIC Classification & Logo CDN', body: 'Added EIC taxonomy with 24 industries and 220 subindustries. Logo Link CDN for one-tag brand logo embeds. Per-field confidence scoring on AI extraction.' },
    ];

    const entriesHTML = entries.map(e => `
      <div class="card">
        <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem">
          <span class="tag ${e.tag === 'release' ? 'green' : 'blue'}">${e.tag}</span>
          <span style="font-size:0.875rem;color:#64748b">${e.date}</span>
        </div>
        <h3>${e.title}</h3>
        <p>${e.body}</p>
      </div>
    `).join('');

    const body = `
      <h1>Changelog</h1>
      <p>Latest updates, releases, and improvements to WebIntel.</p>
      ${entriesHTML}
    `;

    return pageHTML('Changelog', body);
  });

  app.get('/trust', async (request, reply) => {
    reply.type('text/html');

    const body = `
      <h1>Trust Center</h1>
      <p>Security, compliance, and data handling at WebIntel.</p>

      <div class="trust-grid">
        <div class="trust-card">
          <div class="icon">🔒</div>
          <h3>Encryption at Rest</h3>
          <p>All data encrypted with AES-256 at rest in PostgreSQL</p>
        </div>
        <div class="trust-card">
          <div class="icon">🔐</div>
          <h3>Encryption in Transit</h3>
          <p>TLS 1.3 for all API traffic</p>
        </div>
        <div class="trust-card">
          <div class="icon">🛡️</div>
          <h3>API Authentication</h3>
          <p>Bearer token auth with API key hashing (SHA-256)</p>
        </div>
        <div class="trust-card">
          <div class="icon">📋</div>
          <h3>Data Retention</h3>
          <p>Configurable TTLs. Brand cache: 90 days. Scrape cache: 30 days. Defaults apply.</p>
        </div>
        <div class="trust-card">
          <div class="icon">🔍</div>
          <h3>Robots.txt Compliance</h3>
          <p>Built-in robots.txt parser. Respects crawl delays and disallowed paths.</p>
        </div>
        <div class="trust-card">
          <div class="icon">🇮🇳</div>
          <h3>Indian Data Focus</h3>
          <p>Optimized for Indian domains, regional languages, and GST data</p>
        </div>
        <div class="trust-card">
          <div class="icon">📄</div>
          <h3>SOC 2</h3>
          <p>In progress — Type I report expected Q3 2026</p>
        </div>
        <div class="trust-card">
          <div class="icon">🔑</div>
          <h3>API Key Security</h3>
          <p>Keys hashed with SHA-256 before storage. Rotate anytime from dashboard.</p>
        </div>
      </div>

      <h2>Data Processing</h2>
      <div class="card">
        <h3>What we collect</h3>
        <p>We only process the URLs and domains you provide. We do not crawl data without your explicit request. Crawl data is cached for performance and automatically expired based on TTL settings.</p>
      </div>
      <div class="card">
        <h3>Data deletion</h3>
        <p>You can request data deletion at any time by contacting hello@webintel.dev. Cached data automatically expires based on configured TTLs (default: 90 days for brand, 30 days for scrapes).</p>
      </div>
      <div class="card">
        <h3>Subprocessors</h3>
        <p>We use Supabase (PostgreSQL), Cloudflare R2 (object storage), Upstash (Redis), OpenAI and Anthropic (AI extraction), and Razorpay (payments).</p>
      </div>
    `;

    return pageHTML('Trust Center', body);
  });

  app.get('/', async (request, reply) => {
    reply.type('text/html');
    const body = `
      <h1>WebIntel</h1>
      <p>One API, every piece of web context your agent needs. Web scraping, brand intelligence, extraction, classification — unified.</p>
      
      <div style="margin:2rem 0;display:flex;gap:1rem;flex-wrap:wrap">
        <a href="/status" style="display:inline-block;padding:0.75rem 1.5rem;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-weight:600">System Status</a>
        <a href="/changelog" style="display:inline-block;padding:0.75rem 1.5rem;border:1px solid #1e293b;color:#e2e8f0;border-radius:8px;text-decoration:none;font-weight:500">Changelog</a>
        <a href="/trust" style="display:inline-block;padding:0.75rem 1.5rem;border:1px solid #1e293b;color:#e2e8f0;border-radius:8px;text-decoration:none;font-weight:500">Trust Center</a>
      </div>

      <h2>API Endpoints</h2>
      <div style="font-family:monospace;font-size:0.875rem;background:#0f0f17;padding:1rem;border-radius:8px;border:1px solid #1e293b;margin:1rem 0">
        <div style="color:#22c55e">GET /health</div>
        <div style="color:#818cf8">POST /v1/web/scrape/markdown</div>
        <div style="color:#818cf8">POST /v1/web/crawl</div>
        <div style="color:#818cf8">POST /v1/web/extract</div>
        <div style="color:#f59e0b">GET /v1/brand/profile?domain=</div>
        <div style="color:#f59e0b">GET /v1/brand/classify?domain=</div>
        <div style="color:#94a3b8">GET /v1/logo/:domain</div>
      </div>
    `;
    return pageHTML('WebIntel — Web Intelligence API', body);
  });
}
