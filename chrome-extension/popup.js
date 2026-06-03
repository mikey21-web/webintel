const API_BASE = 'https://webintel.diyaaaa.in';

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function extractDomain(url) {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return null; }
}

async function fetchBrandProfile(domain, apiKey) {
  const res = await fetch(`${API_BASE}/v1/brand/profile?domain=${domain}`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Invalid API key');
    if (res.status === 404) throw new Error('No data found for this domain');
    throw new Error(`Request failed (${res.status})`);
  }
  return res.json();
}

function render(data, domain) {
  const container = document.getElementById('content');
  const score = data.score ?? 0;
  let scoreClass = 'score-low';
  if (score >= 7) scoreClass = 'score-high';
  else if (score >= 4) scoreClass = 'score-mid';

  const techCount = data.techStack?.length ?? 0;
  const socialCount = data.socials ? Object.keys(data.socials).length : 0;

  container.innerHTML = `
    <div class="domain-bar">
      <span>&#127760;</span>
      <span class="domain-name">${domain}</span>
    </div>

    <div class="brand-profile">
      <div class="brand-logo">
        ${data.logo ? `<img src="${data.logo}" alt="${data.name}">` : (data.name ? data.name.charAt(0).toUpperCase() : '?')}
      </div>
      <div class="brand-info">
        <div class="brand-name">${data.name || 'Unknown'}</div>
        ${data.description ? `<div class="brand-description">${data.description}</div>` : ''}
        ${data.industry ? `<span class="brand-industry">${data.industry}</span>` : ''}
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-value ${scoreClass}">${score}</div>
        <div class="stat-label">Score</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${techCount}</div>
        <div class="stat-label">Tech Stack</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${socialCount}</div>
        <div class="stat-label">Socials</div>
      </div>
    </div>

    <div class="tabs" role="tablist">
      <button class="tab-btn active" data-tab="overview">Overview</button>
      <button class="tab-btn" data-tab="tech">Tech Stack</button>
      <button class="tab-btn" data-tab="socials">Socials</button>
      <button class="tab-btn" data-tab="pricing">Pricing</button>
    </div>

    <div class="tab-content active" id="tab-overview">
      ${renderOverview(data)}
    </div>
    <div class="tab-content" id="tab-tech">
      ${renderTechStack(data.techStack)}
    </div>
    <div class="tab-content" id="tab-socials">
      ${renderSocials(data.socials)}
    </div>
    <div class="tab-content" id="tab-pricing">
      ${renderPricing(data.pricing)}
    </div>
  `;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

function renderOverview(data) {
  let html = '<ul class="data-list">';
  if (data.oneLiner) html += `<li class="data-item"><span class="data-key">Tagline</span><span class="data-value">${data.oneLiner}</span></li>`;
  if (data.foundedYear) html += `<li class="data-item"><span class="data-key">Founded</span><span class="data-value">${data.foundedYear}</span></li>`;
  if (data.headquarters) html += `<li class="data-item"><span class="data-key">HQ</span><span class="data-value">${data.headquarters}</span></li>`;
  if (data.employeeCount) html += `<li class="data-item"><span class="data-key">Employees</span><span class="data-value">${data.employeeCount}</span></li>`;
  html += '</ul>';

  if (data.swot) {
    html += '<div style="margin-top:12px;font-weight:600;font-size:12px;color:#8b8fa7;margin-bottom:6px;">SWOT Analysis</div>';
    html += '<div class="swot-grid">';
    if (data.swot.strengths) html += `<div class="swot-item swot-s"><div class="swot-label">S</div>${data.swot.strengths}</div>`;
    if (data.swot.weaknesses) html += `<div class="swot-item swot-w"><div class="swot-label">W</div>${data.swot.weaknesses}</div>`;
    if (data.swot.opportunities) html += `<div class="swot-item swot-o"><div class="swot-label">O</div>${data.swot.opportunities}</div>`;
    if (data.swot.threats) html += `<div class="swot-item swot-t"><div class="swot-label">T</div>${data.swot.threats}</div>`;
    html += '</div>';
  }

  if (data.keyFeatures) {
    html += '<div style="margin-top:12px;font-weight:600;font-size:12px;color:#8b8fa7;margin-bottom:4px;">Key Features</div>';
    html += '<ul class="data-list">';
    (Array.isArray(data.keyFeatures) ? data.keyFeatures : []).forEach(f => {
      html += `<li class="data-item"><span class="data-value" style="text-align:left;">${f}</span></li>`;
    });
    html += '</ul>';
  }

  return html;
}

function renderTechStack(stack) {
  if (!stack || stack.length === 0) return '<div style="color:#6b6f82;text-align:center;padding:16px 0;">No tech stack data</div>';
  let html = '<ul class="data-list">';
  stack.forEach(item => {
    const name = typeof item === 'string' ? item : (item.name || item.category || '');
    const category = typeof item === 'string' ? '' : (item.category || '');
    html += `<li class="data-item">
      <span class="data-key">${category ? `<span class="badge badge-green">${category}</span> ` : ''}${name}</span>
    </li>`;
  });
  html += '</ul>';
  return html;
}

function renderSocials(socials) {
  if (!socials || Object.keys(socials).length === 0) return '<div style="color:#6b6f82;text-align:center;padding:16px 0;">No social links found</div>';
  let html = '<ul class="data-list">';
  const platforms = { linkedin: 'LinkedIn', twitter: 'Twitter / X', facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube', github: 'GitHub', crunchbase: 'Crunchbase', angelco: 'AngelList' };
  Object.entries(socials).forEach(([key, url]) => {
    const label = platforms[key] || key;
    html += `<li class="data-item">
      <span class="data-key">${label}</span>
      <span class="data-value"><a href="${url}" target="_blank">${key === 'linkedin' ? 'View &nearr;' : 'Link &nearr;'}</a></span>
    </li>`;
  });
  html += '</ul>';
  return html;
}

function renderPricing(pricing) {
  if (!pricing || (Array.isArray(pricing) && pricing.length === 0)) return '<div style="color:#6b6f82;text-align:center;padding:16px 0;">No pricing data available</div>';
  if (typeof pricing === 'string') return `<div style="color:#e1e4ea;padding:8px 0;">${pricing}</div>`;
  let html = '';
  (Array.isArray(pricing) ? pricing : [pricing]).forEach(p => {
    html += `<div class="pricing-item">
      <div class="pricing-name">${p.plan || p.name || 'Plan'}</div>
      ${p.amount ? `<div class="pricing-amount">${p.amount}</div>` : ''}
      ${p.description ? `<div class="pricing-desc">${p.description}</div>` : ''}
    </div>`;
  });
  return html;
}

function showError(message, isApiKeyMissing) {
  const container = document.getElementById('content');
  container.innerHTML = `
    <div class="error-state">
      <div class="error-icon">${isApiKeyMissing ? '&#128273;' : '&#9888;'}</div>
      <div class="error-title">${isApiKeyMissing ? 'API Key Required' : 'Error'}</div>
      <div class="error-desc">${message}</div>
      ${isApiKeyMissing ? '<button class="error-btn" id="openSettings">Open Settings</button>' : ''}
    </div>
  `;
  if (isApiKeyMissing) {
    document.getElementById('openSettings').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }
}

async function init() {
  const tab = await getCurrentTab();
  const domain = extractDomain(tab.url);
  if (!domain) {
    showError('Could not detect domain', false);
    return;
  }

  document.getElementById('fullReportLink').href = `https://dash.webintel.diyaaaa.in/domain/${domain}`;

  const { apiKey } = await chrome.storage.sync.get('apiKey');
  if (!apiKey) {
    showError('Configure your WebIntel API key in Settings to use the extension.', true);
    return;
  }

  try {
    const data = await fetchBrandProfile(domain, apiKey);
    render(data, domain);
  } catch (err) {
    showError(err.message, false);
  }
}

document.getElementById('settingsBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());

document.addEventListener('DOMContentLoaded', init);
