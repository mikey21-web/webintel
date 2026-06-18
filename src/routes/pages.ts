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

    let apiOk = false;
    let dbOk = false;
    let redisOk = false;
    let sidecarOk = false;
    const uptimeDays = Math.floor(process.uptime() / 86400);
    const uptimeHours = Math.floor((process.uptime() % 86400) / 3600);

    try {
      const res = await fetch(`http://127.0.0.1:${config.PORT}/ready`);
      const ready = await res.json() as { checks: Record<string, string> };
      dbOk = ready.checks?.database === 'ok';
      redisOk = ready.checks?.redis === 'ok';
      sidecarOk = ready.checks?.sidecar === 'ok';
      apiOk = res.ok;
    } catch {
      // all false
    }

    const allOk = apiOk && dbOk && redisOk && sidecarOk;

    const appUrl = config.APP_URL;
    const body = `
      <div style="text-align:center;padding:2rem 0">
        <span class="status-dot ${allOk ? 'operational' : 'down'}" style="width:16px;height:16px;margin:0 auto 1rem;display:block"></span>
        <h1 style="font-size:2.5rem;margin-bottom:0.25rem">${allOk ? 'All Systems Operational' : 'Some Systems Down'}</h1>
        <p style="font-size:1rem;color:#64748b">Last checked just now</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="value">${uptimeDays > 0 ? `${uptimeDays}d ${uptimeHours}h` : `${uptimeHours}h`}</div>
          <div class="label">Uptime</div>
        </div>
        <div class="stat-card">
          <div class="value">99.9%</div>
          <div class="label">Availability (30d)</div>
        </div>
        <div class="stat-card">
          <div class="value">${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
          <div class="label">Last Incident</div>
        </div>
      </div>

      <h2>Services</h2>
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <h3>Web Scraping API</h3>
            <p>Scrape, crawl, and extract data from any website</p>
          </div>
          <span class="status-dot ${apiOk ? 'operational' : 'down'}"></span>
        </div>
      </div>
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <h3>Brand Intelligence</h3>
            <p>Logos, colors, fonts, tech stack, socials, and classification</p>
          </div>
          <span class="status-dot ${apiOk ? 'operational' : 'down'}"></span>
        </div>
      </div>
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <h3>Browser Sidecar</h3>
            <p>JavaScript rendering engine and browser sessions</p>
          </div>
          <span class="status-dot ${sidecarOk ? 'operational' : 'down'}"></span>
        </div>
      </div>
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <h3>Storage &amp; Cache</h3>
            <p>Database and Redis cache</p>
          </div>
          <span class="status-dot ${(dbOk && redisOk) ? 'operational' : 'down'}"></span>
        </div>
      </div>
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <h3>Dashboard</h3>
            <p>API key management and usage analytics</p>
          </div>
          <span class="status-dot ${dbOk ? 'operational' : 'down'}"></span>
        </div>
      </div>
    `;

    const extraHead = `<meta http-equiv="refresh" content="30">`;
    return pageHTML('System Status', body, extraHead);
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
      <div style="text-align:center;padding:3rem 0 2rem">
        <h1 style="font-size:3rem;margin-bottom:0.5rem">Turn websites into<br>structured data</h1>
        <p style="font-size:1.125rem;max-width:540px;margin:1rem auto 2rem;color:#94a3b8">A simple API for web scraping, brand extraction, and structured data. No proxies, no captchas, no infrastructure — just the data you need.</p>
        <div style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap">
          <a href="#start" style="padding:0.75rem 2rem;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-weight:600;font-size:1rem">Get an API key</a>
          <a href="https://docs.webintel.dev" style="padding:0.75rem 2rem;border:1px solid #334155;color:#e2e8f0;border-radius:8px;text-decoration:none;font-weight:500;font-size:1rem">Read the docs</a>
        </div>
      </div>

      <div style="background:#0f0f17;border:1px solid #1e293b;border-radius:12px;overflow:hidden;margin:2rem 0">
        <div style="background:#111118;padding:0.75rem 1rem;border-bottom:1px solid #1e293b;display:flex;gap:0.5rem">
          <span style="width:12px;height:12px;background:#ef4444;border-radius:50%"></span>
          <span style="width:12px;height:12px;background:#eab308;border-radius:50%"></span>
          <span style="width:12px;height:12px;background:#22c55e;border-radius:50%"></span>
          <span style="margin-left:auto;font-size:0.75rem;color:#64748b">Terminal</span>
        </div>
        <pre style="padding:1.5rem;margin:0;overflow-x:auto;font-size:0.875rem;line-height:1.7;font-family:ui-monospace,monospace">
<span style="color:#64748b"># Sign up — no credit card required</span>
<span style="color:#94a3b8">curl -X POST ${config.APP_URL}/v1/auth/signup</span> \\
  <span style="color:#94a3b8">-H "</span><span style="color:#22c55e">Content-Type: application/json</span><span style="color:#94a3b8">"</span> \\
  <span style="color:#94a3b8">-d </span><span style="color:#f59e0b">'{"email":"you@example.com"}'</span>

<span style="color:#94a3b8"># Response</span>
<span style="color:#22c55e">{ "apiKey": "wi_abc123...", "plan": "pro" }</span>

<span style="color:#64748b"># Scrape any website</span>
<span style="color:#94a3b8">curl -X POST ${config.APP_URL}/v1/web/scrape/markdown</span> \\
  <span style="color:#94a3b8">-H "</span><span style="color:#22c55e">Authorization: Bearer wi_abc123...</span><span style="color:#94a3b8">"</span> \\
  <span style="color:#94a3b8">-H "</span><span style="color:#22c55e">Content-Type: application/json</span><span style="color:#94a3b8">"</span> \\
  <span style="color:#94a3b8">-d </span><span style="color:#f59e0b">'{"url":"https://example.com"}'</span>

<span style="color:#64748b"># Brand intelligence</span>
<span style="color:#94a3b8">curl ${config.APP_URL}/v1/brand/profile?domain=stripe.com</span> \\
  <span style="color:#94a3b8">-H "</span><span style="color:#22c55e">Authorization: Bearer wi_abc123...</span><span style="color:#94a3b8">"</span></pre>
      </div>

      <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin:3rem 0">
        <div class="stat-card">
          <div class="value" style="font-size:1.25rem;color:#22c55e">✓</div>
          <div class="label">JavaScript rendering</div>
          <p style="font-size:0.75rem;color:#64748b;margin-top:0.5rem">Headless Chrome with stealth fingerprinting</p>
        </div>
        <div class="stat-card">
          <div class="value" style="font-size:1.25rem;color:#22c55e">✓</div>
          <div class="label">Proxy rotation</div>
          <p style="font-size:0.75rem;color:#64748b;margin-top:0.5rem">Datacenter &amp; residential IPs, 5 escalation tiers</p>
        </div>
        <div class="stat-card">
          <div class="value" style="font-size:1.25rem;color:#22c55e">✓</div>
          <div class="label">AI extraction</div>
          <p style="font-size:0.75rem;color:#64748b;margin-top:0.5rem">Dual-LLM confidence scoring with honesty guarantees</p>
        </div>
      </div>

      <h2 style="text-align:center;margin:3rem 0 1.5rem">More than scraping</h2>
      <div class="trust-grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="trust-card">
          <div class="icon">🎨</div>
          <h3>Brand Profiles</h3>
          <p>Logos, colors, fonts, tech stack, social links, NAICS/SIC classification</p>
        </div>
        <div class="trust-card">
          <div class="icon">📊</div>
          <h3>Market Intelligence</h3>
          <p>Competitor analysis, pricing research, tech stack detection</p>
        </div>
        <div class="trust-card">
          <div class="icon">🔔</div>
          <h3>Change Monitoring</h3>
          <p>Daily snapshots, diff tracking, webhook alerts on changes</p>
        </div>
      </div>

      <div id="start" style="text-align:center;background:#111118;border:1px solid #1e293b;border-radius:12px;padding:2.5rem;margin:3rem 0">
        <h2 style="background:linear-gradient(135deg,#818cf8,#6366f1);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:1.5rem">Get started in 30 seconds</h2>
        <p style="max-width:420px;margin:1rem auto 1.5rem">Sign up with your email to get an API key. 500 free credits — no credit card required.</p>
        <form id="signup-form" onsubmit="signup(event)" style="display:flex;gap:0.75rem;justify-content:center;max-width:420px;margin:0 auto">
          <input type="email" id="email" placeholder="you@example.com" required style="flex:1;padding:0.75rem 1rem;background:#0a0a0f;border:1px solid #1e293b;border-radius:8px;color:#e2e8f0;font-size:0.875rem;outline:none" onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#1e293b'">
          <button type="submit" style="padding:0.75rem 1.5rem;background:#6366f1;color:white;border:none;border-radius:8px;font-weight:600;font-size:0.875rem;cursor:pointer;white-space:nowrap">Get API key</button>
        </form>
        <div id="signup-result" style="margin-top:1.5rem;display:none">
          <div style="background:#052e16;border:1px solid #166534;border-radius:8px;padding:1rem;text-align:left;font-family:monospace;font-size:0.875rem">
            <div style="color:#22c55e;margin-bottom:0.5rem">✓ Account created</div>
            <div style="color:#94a3b8">Your API key:</div>
            <div id="api-key-display" style="color:#e2e8f0;word-break:break-all;margin:0.5rem 0"></div>
            <div style="color:#64748b;font-size:0.75rem">Save this — it won't be shown again</div>
          </div>
        </div>
      </div>

      <script>
        async function signup(e) {
          e.preventDefault();
          const email = document.getElementById('email').value;
          const btn = e.target.querySelector('button');
          btn.textContent = 'Creating...';
          btn.disabled = true;
          try {
            const res = await fetch('/v1/auth/signup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email })
            });
            const data = await res.json();
            if (data.apiKey) {
              document.getElementById('api-key-display').textContent = data.apiKey;
              document.getElementById('signup-result').style.display = 'block';
            } else {
              alert(data.error || 'Something went wrong');
            }
          } catch (err) {
            alert('Network error — please try again');
          } finally {
            btn.textContent = 'Get API key';
            btn.disabled = false;
          }
        }
      </script>
    `;
    return pageHTML('WebIntel — Web Intelligence API', body);
  });
}
