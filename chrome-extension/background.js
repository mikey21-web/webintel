chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.storage.sync.set({
      apiKey: '',
      baseUrl: 'https://webintel.diyaaaa.in'
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_API_KEY') {
    chrome.storage.sync.get('apiKey', ({ apiKey }) => {
      sendResponse({ apiKey });
    });
    return true;
  }
  if (message.type === 'FETCH_BRAND_INTEL') {
    chrome.storage.sync.get(['apiKey', 'baseUrl'], async ({ apiKey, baseUrl }) => {
      try {
        const res = await fetch(`${baseUrl || 'https://webintel.diyaaaa.in'}/v1/brand/profile?domain=${message.domain}`, {
          headers: { Authorization: `Bearer ${apiKey}` }
        });
        if (!res.ok) {
          sendResponse({ error: `Request failed (${res.status})` });
          return;
        }
        const data = await res.json();
        sendResponse({ data });
      } catch (err) {
        sendResponse({ error: err.message });
      }
    });
    return true;
  }
});
