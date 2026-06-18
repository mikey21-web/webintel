import puppeteer from 'puppeteer-core';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { uploadToR2 } from '../storage/r2';
import crypto from 'crypto';

const TEMPLATES_DIR = join(__dirname, 'templates');

function getTemplate(module: string): string {
  const map: Record<string, string> = {
    competitor: 'competitor.html',
    market_map: 'competitor.html',
    lead_intel: 'competitor.html',
    sales_brief: 'competitor.html',
    pricing_intel: 'competitor.html',
    tech_stack: 'competitor.html',
  };
  const file = map[module] || 'competitor.html';
  const path = join(TEMPLATES_DIR, file);
  if (!existsSync(path)) throw new Error(`Template not found: ${file}`);
  return readFileSync(path, 'utf-8');
}

function getCSS(): string {
  const path = join(TEMPLATES_DIR, 'base.css');
  if (!existsSync(path)) throw new Error('base.css not found');
  return readFileSync(path, 'utf-8');
}

export async function generateReport(module: string, data: Record<string, any>): Promise<string> {
  let html = getTemplate(module);
  const css = getCSS();

  html = html.replace('</head>', `<style>${css}</style>\n</head>`);
  html = html.replace('REPORT_DATA', JSON.stringify(data));

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } });

    const key = `reports/${module}/${crypto.randomUUID()}.pdf`;
    const url = await uploadToR2(key, pdfBuffer, 'application/pdf');
    return url;
  } finally {
    await browser.close();
  }
}
