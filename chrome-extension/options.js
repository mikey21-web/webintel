const apiKeyInput = document.getElementById('apiKey');
const baseUrlInput = document.getElementById('baseUrl');
const saveBtn = document.getElementById('saveBtn');
const testBtn = document.getElementById('testBtn');
const statusEl = document.getElementById('status');

function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

async function loadSettings() {
  const { apiKey, baseUrl } = await chrome.storage.sync.get(['apiKey', 'baseUrl']);
  if (apiKey) apiKeyInput.value = apiKey;
  if (baseUrl) baseUrlInput.value = baseUrl;
  else baseUrlInput.value = 'https://webintel.diyaaaa.in';
}

async function saveSettings() {
  const apiKey = apiKeyInput.value.trim();
  const baseUrl = baseUrlInput.value.trim() || 'https://webintel.diyaaaa.in';

  if (!apiKey) {
    setStatus('Please enter an API key', 'error');
    return;
  }

  await chrome.storage.sync.set({ apiKey, baseUrl });
  setStatus('Settings saved successfully', 'success');
}

async function testConnection() {
  const baseUrl = baseUrlInput.value.trim() || 'https://webintel.diyaaaa.in';
  setStatus('Testing connection...', 'loading');
  testBtn.disabled = true;

  try {
    const res = await fetch(`${baseUrl}/health`, { method: 'GET' });
    if (res.ok) {
      setStatus('Connection successful! API is reachable.', 'success');
    } else {
      setStatus(`Connection failed with status ${res.status}`, 'error');
    }
  } catch (err) {
    setStatus(`Connection error: ${err.message}`, 'error');
  } finally {
    testBtn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', loadSettings);
saveBtn.addEventListener('click', saveSettings);
testBtn.addEventListener('click', testConnection);
