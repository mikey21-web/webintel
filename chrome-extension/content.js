(function () {
  'use strict';

  const domain = window.location.hostname.replace('www.', '');
  if (!domain) return;

  let brandData = null;
  let tooltipEl = null;
  let btnEl = null;

  function createFloatingButton() {
    btnEl = document.createElement('div');
    btnEl.id = '__webintel_btn';
    btnEl.innerHTML = 'W';
    Object.assign(btnEl.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '40px',
      height: '40px',
      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
      color: '#fff',
      borderRadius: '10px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: '800',
      fontSize: '16px',
      fontFamily: '"Inter", sans-serif',
      cursor: 'pointer',
      zIndex: '2147483647',
      boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
      transition: 'transform 0.2s, box-shadow 0.2s',
      userSelect: 'none'
    });
    btnEl.addEventListener('mouseenter', showTooltip);
    btnEl.addEventListener('mouseleave', () => { if (tooltipEl) tooltipEl.style.display = 'none'; });
    btnEl.addEventListener('click', () => {
      window.open(`https://dash.webintel.diyaaaa.in/domain/${domain}`, '_blank');
    });
    document.body.appendChild(btnEl);
  }

  function createTooltip() {
    tooltipEl = document.createElement('div');
    tooltipEl.id = '__webintel_tooltip';
    Object.assign(tooltipEl.style, {
      position: 'fixed',
      bottom: '68px',
      right: '20px',
      background: '#0f1117',
      color: '#e1e4ea',
      borderRadius: '12px',
      padding: '16px',
      fontFamily: '"Inter", -apple-system, sans-serif',
      fontSize: '13px',
      zIndex: '2147483647',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      border: '1px solid #1e2030',
      minWidth: '200px',
      display: 'none',
      lineHeight: '1.4'
    });
    document.body.appendChild(tooltipEl);
  }

  function showTooltip() {
    if (!tooltipEl) createTooltip();
    if (brandData) {
      renderTooltip(brandData);
    } else {
      tooltipEl.innerHTML = '<div style="text-align:center;color:#6b6f82;">Loading...</div>';
      fetchBrandIntel();
    }
    tooltipEl.style.display = 'block';
  }

  function renderTooltip(data) {
    const name = data.name || domain;
    const score = data.score ?? '--';
    tooltipEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <div style="width:32px;height:32px;border-radius:6px;background:#1e2030;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:#6366f1;flex-shrink:0;overflow:hidden;">
          ${data.logo ? `<img src="${data.logo}" style="width:100%;height:100%;object-fit:contain;">` : name.charAt(0).toUpperCase()}
        </div>
        <div style="font-weight:600;font-size:14px;color:#f0f2f8;">${name}</div>
      </div>
      ${data.description ? `<div style="font-size:11px;color:#6b6f82;margin-bottom:6px;">${data.description}</div>` : ''}
      <div style="display:flex;gap:12px;font-size:12px;">
        <span style="color:#8b8fa7;">Score: <strong style="color:${score >= 7 ? '#34d399' : score >= 4 ? '#fbbf24' : '#f87171'}">${score}</strong></span>
        ${data.industry ? `<span style="color:#8b8fa7;">${data.industry}</span>` : ''}
      </div>
    `;
  }

  async function fetchBrandIntel() {
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'FETCH_BRAND_INTEL', domain });
      if (resp?.data) {
        brandData = resp.data;
        if (tooltipEl && tooltipEl.style.display === 'block') renderTooltip(brandData);
      }
    } catch { }
  }

  function initContentScript() {
    createFloatingButton();
    fetchBrandIntel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContentScript);
  } else {
    initContentScript();
  }
})();
