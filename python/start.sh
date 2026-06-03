#!/bin/bash
set -e
source venv/bin/activate

echo "[webintel] Installing core Python deps..."
pip install -r requirements.txt

echo "[webintel] Installing Playwright browsers..."
playwright install chromium

echo "[webintel] Installing optional Node.js scrapers..."
cd "$(dirname "$0")"
if command -v npm &> /dev/null; then
    npm install -g puppeteer-extra puppeteer-extra-plugin-stealth 2>/dev/null || true
    npm install -g crawlee 2>/dev/null || true
    npm install -g got-scraping 2>/dev/null || true
fi

echo "[webintel] Starting engine on port 8765..."
uvicorn main:app --host 0.0.0.0 --port 8765 --workers 2 --loop asyncio
