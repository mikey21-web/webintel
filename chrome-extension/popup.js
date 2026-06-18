async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function extractDomain(url) {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return null; }
}

async function fetchBrandProfile(domain, apiKey, baseUrl) {
  const res = await fetch(`${baseUrl}/v1/brand/profile?domain=${domain}`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Invalid API key');
    if (res.status === 404) throw new Error('No data found for this domain');
    throw new Error(`Request failed (${res.status})`);
  }
  return res.json();
}

function validateUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch { return false; }
}

function createElement(tag, attrs, children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'className') el.className = v;
      else if (k === 'textContent') el.textContent = v;
      else el.setAttribute(k, v);
    }
  }
  if (children) {
    for (const child of children) {
      if (typeof child === 'string') {
        el.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        el.appendChild(child);
      }
    }
  }
  return el;
}

function render(data, domain) {
  const container = document.getElementById('content');
  container.textContent = '';
  const score = data.score ?? 0;
  let scoreClass = 'score-low';
  if (score >= 7) scoreClass = 'score-high';
  else if (score >= 4) scoreClass = 'score-mid';

  const techCount = data.techStack?.length ?? 0;
  const socialCount = data.socials ? Object.keys(data.socials).length : 0;

  const domainBar = createElement('div', { className: 'domain-bar' }, [
    createElement('span', { textContent: '\u{1F310}' }),
    createElement('span', { className: 'domain-name', textContent: domain }),
  ]);
  container.appendChild(domainBar);

  const brandProfile = createElement('div', { className: 'brand-profile' });
  const brandLogo = createElement('div', { className: 'brand-logo' });
  if (data.logo && validateUrl(data.logo)) {
    const img = createElement('img', { src: data.logo, alt: data.name || '' });
    brandLogo.appendChild(img);
  } else {
    brandLogo.textContent = data.name ? data.name.charAt(0).toUpperCase() : '?';
  }
  brandProfile.appendChild(brandLogo);

  const brandInfo = createElement('div', { className: 'brand-info' });
  brandInfo.appendChild(createElement('div', { className: 'brand-name', textContent: data.name || 'Unknown' }));
  if (data.description) {
    brandInfo.appendChild(createElement('div', { className: 'brand-description', textContent: data.description }));
  }
  if (data.industry) {
    brandInfo.appendChild(createElement('span', { className: 'brand-industry', textContent: data.industry }));
  }
  brandProfile.appendChild(brandInfo);
  container.appendChild(brandProfile);

  const statsRow = createElement('div', { className: 'stats-row' });
  statsRow.appendChild(createStatCard('Score', score, scoreClass));
  statsRow.appendChild(createStatCard('Tech Stack', techCount));
  statsRow.appendChild(createStatCard('Socials', socialCount));
  container.appendChild(statsRow);

  const tabsDiv = createElement('div', { className: 'tabs', role: 'tablist' });
  const tabNames = ['overview', 'tech', 'socials', 'pricing'];
  const tabLabels = ['Overview', 'Tech Stack', 'Socials', 'Pricing'];
  tabNames.forEach((name, i) => {
    const btn = createElement('button', {
      className: 'tab-btn' + (i === 0 ? ' active' : ''),
      'data-tab': name,
      textContent: tabLabels[i],
    });
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const content = document.getElementById('tab-' + name);
      if (content) content.classList.add('active');
    });
    tabsDiv.appendChild(btn);
  });
  container.appendChild(tabsDiv);

  const tabContentOverview = createElement('div', { className: 'tab-content active', id: 'tab-overview' });
  renderOverview(data, tabContentOverview);
  container.appendChild(tabContentOverview);

  const tabContentTech = createElement('div', { className: 'tab-content', id: 'tab-tech' });
  renderTechStack(data.techStack, tabContentTech);
  container.appendChild(tabContentTech);

  const tabContentSocials = createElement('div', { className: 'tab-content', id: 'tab-socials' });
  renderSocials(data.socials, tabContentSocials);
  container.appendChild(tabContentSocials);

  const tabContentPricing = createElement('div', { className: 'tab-content', id: 'tab-pricing' });
  renderPricing(data.pricing, tabContentPricing);
  container.appendChild(tabContentPricing);
}

function createStatCard(label, value, valueClass) {
  const card = createElement('div', { className: 'stat-card' });
  const valueEl = createElement('div', { className: 'stat-value' + (valueClass ? ' ' + valueClass : ''), textContent: String(value) });
  card.appendChild(valueEl);
  card.appendChild(createElement('div', { className: 'stat-label', textContent: label }));
  return card;
}

function renderOverview(data, container) {
  const list = createElement('ul', { className: 'data-list' });
  if (data.oneLiner) list.appendChild(createDataItem('Tagline', data.oneLiner));
  if (data.foundedYear) list.appendChild(createDataItem('Founded', data.foundedYear));
  if (data.headquarters) list.appendChild(createDataItem('HQ', data.headquarters));
  if (data.employeeCount) list.appendChild(createDataItem('Employees', data.employeeCount));
  container.appendChild(list);

  if (data.swot) {
    container.appendChild(createElement('div', {
      className: 'swot-section-header',
      textContent: 'SWOT Analysis',
    }));
    const swotGrid = createElement('div', { className: 'swot-grid' });
    if (data.swot.strengths) swotGrid.appendChild(createSwotItem('swot-s', 'S', data.swot.strengths));
    if (data.swot.weaknesses) swotGrid.appendChild(createSwotItem('swot-w', 'W', data.swot.weaknesses));
    if (data.swot.opportunities) swotGrid.appendChild(createSwotItem('swot-o', 'O', data.swot.opportunities));
    if (data.swot.threats) swotGrid.appendChild(createSwotItem('swot-t', 'T', data.swot.threats));
    container.appendChild(swotGrid);
  }

  if (data.keyFeatures) {
    container.appendChild(createElement('div', {
      className: 'section-header',
      textContent: 'Key Features',
    }));
    const featuresList = createElement('ul', { className: 'data-list' });
    (Array.isArray(data.keyFeatures) ? data.keyFeatures : []).forEach(f => {
      featuresList.appendChild(createDataItem(null, f));
    });
    container.appendChild(featuresList);
  }
}

function createDataItem(key, value) {
  const li = createElement('li', { className: 'data-item' });
  if (key) {
    li.appendChild(createElement('span', { className: 'data-key', textContent: key }));
  }
  const valueEl = createElement('span', {
    className: 'data-value' + (key ? '' : ' no-key'),
    textContent: value,
  });
  li.appendChild(valueEl);
  return li;
}

function createSwotItem(cls, label, text) {
  return createElement('div', { className: 'swot-item ' + cls }, [
    createElement('div', { className: 'swot-label', textContent: label }),
    document.createTextNode(text),
  ]);
}

function renderTechStack(stack, container) {
  if (!stack || stack.length === 0) {
    container.appendChild(createElement('div', {
      className: 'empty-state',
      textContent: 'No tech stack data',
    }));
    return;
  }
  const list = createElement('ul', { className: 'data-list' });
  stack.forEach(item => {
    const name = typeof item === 'string' ? item : (item.name || item.category || '');
    const category = typeof item === 'string' ? '' : (item.category || '');
    const li = createElement('li', { className: 'data-item' });
    const keySpan = createElement('span', { className: 'data-key' });
    if (category) {
      keySpan.appendChild(createElement('span', { className: 'badge badge-green', textContent: category }));
      keySpan.appendChild(document.createTextNode(' '));
    }
    keySpan.appendChild(document.createTextNode(name));
    li.appendChild(keySpan);
    list.appendChild(li);
  });
  container.appendChild(list);
}

function renderSocials(socials, container) {
  if (!socials || Object.keys(socials).length === 0) {
    container.appendChild(createElement('div', {
      className: 'empty-state',
      textContent: 'No social links found',
    }));
    return;
  }
  const list = createElement('ul', { className: 'data-list' });
  const platforms = { linkedin: 'LinkedIn', twitter: 'Twitter / X', facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube', github: 'GitHub', crunchbase: 'Crunchbase', angelco: 'AngelList' };
  for (const [key, url] of Object.entries(socials)) {
    const label = platforms[key] || key;
    const li = createElement('li', { className: 'data-item' });
    li.appendChild(createElement('span', { className: 'data-key', textContent: label }));
    const valueSpan = createElement('span', { className: 'data-value' });
    if (typeof url === 'string' && validateUrl(url)) {
      const a = createElement('a', { href: url, target: '_blank' });
      a.textContent = key === 'linkedin' ? 'View \u2197' : 'Link \u2197';
      valueSpan.appendChild(a);
    } else {
      valueSpan.textContent = String(url);
    }
    li.appendChild(valueSpan);
    list.appendChild(li);
  }
  container.appendChild(list);
}

function renderPricing(pricing, container) {
  if (!pricing || (Array.isArray(pricing) && pricing.length === 0)) {
    container.appendChild(createElement('div', {
      className: 'empty-state',
      textContent: 'No pricing data available',
    }));
    return;
  }
  if (typeof pricing === 'string') {
    container.appendChild(createElement('div', { className: 'pricing-text', textContent: pricing }));
    return;
  }
  (Array.isArray(pricing) ? pricing : [pricing]).forEach(p => {
    const item = createElement('div', { className: 'pricing-item' });
    item.appendChild(createElement('div', { className: 'pricing-name', textContent: p.plan || p.name || 'Plan' }));
    if (p.amount) item.appendChild(createElement('div', { className: 'pricing-amount', textContent: p.amount }));
    if (p.description) item.appendChild(createElement('div', { className: 'pricing-desc', textContent: p.description }));
    container.appendChild(item);
  });
}

function showError(message, isApiKeyMissing) {
  const container = document.getElementById('content');
  container.textContent = '';

  const errorState = createElement('div', { className: 'error-state' });
  errorState.appendChild(createElement('div', {
    className: 'error-icon',
    textContent: isApiKeyMissing ? '\u{1F511}' : '\u26A0',
  }));
  errorState.appendChild(createElement('div', {
    className: 'error-title',
    textContent: isApiKeyMissing ? 'API Key Required' : 'Error',
  }));
  errorState.appendChild(createElement('div', { className: 'error-desc', textContent: message }));
  if (isApiKeyMissing) {
    const btn = createElement('button', { className: 'error-btn', id: 'openSettings', textContent: 'Open Settings' });
    btn.addEventListener('click', () => { chrome.runtime.openOptionsPage(); });
    errorState.appendChild(btn);
  }
  container.appendChild(errorState);
}

async function init() {
  const tab = await getCurrentTab();
  const domain = extractDomain(tab.url);
  if (!domain) {
    showError('Could not detect domain', false);
    return;
  }

  const fullReportLink = document.getElementById('fullReportLink');
  fullReportLink.href = 'https://dash.webintel.diyaaaa.in/domain/' + encodeURIComponent(domain);

  const { apiKey, baseUrl } = await chrome.storage.sync.get(['apiKey', 'baseUrl']);
  if (!apiKey) {
    showError('Configure your WebIntel API key in Settings to use the extension.', true);
    return;
  }

  try {
    const data = await fetchBrandProfile(domain, apiKey, baseUrl || 'https://api.webintel.dev');
    render(data, domain);
  } catch (err) {
    showError(err.message, false);
  }
}

document.getElementById('settingsBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());

document.addEventListener('DOMContentLoaded', init);
