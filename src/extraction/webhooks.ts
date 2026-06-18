import crypto from 'crypto';
import { config } from '../config';

function validateWebhookUrl(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Webhook URL must use HTTP or HTTPS');
  }
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    throw new Error('Webhook URL must not point to localhost');
  }
  if (hostname.startsWith('10.')) throw new Error('Webhook URL must not point to private IP range');
  if (hostname.startsWith('172.') && /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) throw new Error('Webhook URL must not point to private IP range');
  if (hostname.startsWith('192.168.')) throw new Error('Webhook URL must not point to private IP range');
  if (hostname.startsWith('169.254.')) throw new Error('Webhook URL must not point to link-local range');
}

export type ContractWebhookEvent =
  | 'extraction.value_changed'
  | 'extraction.schema_healed'
  | 'extraction.needs_review';

export interface WebhookPayload {
  event: ContractWebhookEvent;
  contractId: string;
  url: string;
  runId: string;
  timestamp: string;
  changedFields?: string[];
  healedFields?: string[];
  diff?: Record<string, { before: unknown; after: unknown }>;
  status: string;
}

export async function deliverContractWebhook(
  webhookUrl: string,
  payload: WebhookPayload,
): Promise<void> {
  validateWebhookUrl(webhookUrl);

  const body = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', config.WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WebIntel-Signature': signature,
          'X-WebIntel-Event': payload.event,
          'X-WebIntel-ContractId': payload.contractId,
        },
        body,
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) return;

      if (i < 2) {
        await new Promise((r) => setTimeout(r, [5000, 25000, 125000][i]));
      }
    } catch {
      if (i < 2) {
        await new Promise((r) => setTimeout(r, [5000, 25000, 125000][i]));
      }
    }
  }
}
