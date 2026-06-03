import { config } from '../config';
import { monitors } from '../db/schema';

const severityEmoji: Record<string, string> = { low: '🟢', medium: '🟡', high: '🔴' };

interface Alert {
  id: string;
  monitorId: string;
  summary: string;
  severity: string;
  changes: any;
  diff?: string;
}

type Monitor = typeof monitors.$inferSelect;

async function sendWhatsApp(alert: Alert, monitor: Monitor) {
  if (!config.EVOLUTION_API_URL || !config.EVOLUTION_API_KEY || !config.EVOLUTION_INSTANCE) return;
  const urls = (monitor.urls as string[]) || [];
  const label = monitor.name || urls[0] || 'unknown';
  const message = `${severityEmoji[alert.severity] || 'ℹ️'} *Change Detected: ${label}*\n${alert.summary}\nSeverity: ${alert.severity.toUpperCase()}`;
  try {
    await fetch(`${config.EVOLUTION_API_URL}/message/sendText/${config.EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': config.EVOLUTION_API_KEY },
      body: JSON.stringify({ number: 'admin', text: message }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error('WhatsApp alert failed:', err);
  }
}

async function sendWebhook(alert: Alert, monitor: Monitor) {
  const urls = (monitor.urls as string[]) || [];
  const targetUrl = urls[0] || '';
  try {
    await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'monitor.alert',
        monitorId: monitor.id,
        alertId: alert.id,
        url: targetUrl,
        severity: alert.severity,
        summary: alert.summary,
        changes: alert.changes,
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    console.error('Webhook alert delivery failed');
  }
}

function sendEmail(alert: Alert, monitor: Monitor) {
  const urls = (monitor.urls as string[]) || [];
  const label = monitor.name || urls[0] || 'unknown';
  console.log(`[EMAIL] Alert: ${label}`);
  console.log(`[EMAIL] Severity: ${severityEmoji[alert.severity]} ${alert.severity.toUpperCase()}`);
  console.log(`[EMAIL] Summary: ${alert.summary}`);
  console.log(`[EMAIL] Changes: ${JSON.stringify(alert.changes)}`);
  console.log(`[EMAIL] Time: ${new Date().toISOString()}`);
}

export async function dispatchAlert(alert: Alert, monitor: Monitor) {
  await Promise.allSettled([
    sendWhatsApp(alert, monitor),
    sendWebhook(alert, monitor),
    sendEmail(alert, monitor),
  ]);
}
