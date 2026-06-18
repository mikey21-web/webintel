import crypto from 'crypto';
import { config } from '../config';

interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  notes: Record<string, string>;
  created_at: number;
}

interface RazorpayCustomer {
  id: string;
  entity: string;
  name: string;
  email: string;
  contact: string;
  created_at: number;
}

export function getRazorpayAuth(): string {
  if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET) return '';
  return Buffer.from(`${config.RAZORPAY_KEY_ID}:${config.RAZORPAY_KEY_SECRET}`).toString('base64');
}

export function razorpayEnabled(): boolean {
  return !!(config.RAZORPAY_KEY_ID && config.RAZORPAY_KEY_SECRET);
}

async function razorpayRequest(method: string, path: string, body?: any): Promise<any> {
  const auth = getRazorpayAuth();
  if (!auth) throw new Error('Razorpay not configured');

  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Razorpay error ${res.status}: ${err}`);
  }

  return res.json();
}

export async function createOrder(amountINR: number, receipt: string, notes: Record<string, string> = {}): Promise<RazorpayOrder> {
  return razorpayRequest('POST', '/orders', {
    amount: amountINR * 100,
    currency: 'INR',
    receipt,
    notes,
  });
}

export async function createSubscription(planId: string, customerEmail: string, totalCount: number = 12): Promise<any> {
  return razorpayRequest('POST', '/subscriptions', {
    plan_id: planId,
    customer_notify: 1,
    total_count: totalCount,
    notes: { email: customerEmail },
  });
}

export async function createPlan(name: string, amountINR: number, interval: 'monthly' | 'yearly', credits: number): Promise<any> {
  return razorpayRequest('POST', '/plans', {
    period: interval,
    interval: 1,
    item: {
      name: `${name} (${credits.toLocaleString()} credits)`,
      amount: amountINR * 100,
      currency: 'INR',
      description: `${credits.toLocaleString()} credits per ${interval === 'monthly' ? 'month' : 'year'}`,
    },
  });
}

export async function verifyPayment(orderId: string, paymentId: string, signature: string): Promise<boolean> {
  if (!config.RAZORPAY_WEBHOOK_SECRET) return false;
  const expectedSig = crypto
    .createHmac('sha256', config.RAZORPAY_WEBHOOK_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return expectedSig === signature;
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  if (!config.RAZORPAY_WEBHOOK_SECRET) return false;
  const expectedSig = crypto
    .createHmac('sha256', config.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');
  return expectedSig === signature;
}

export async function getPayment(paymentId: string): Promise<any> {
  return razorpayRequest('GET', `/payments/${paymentId}`);
}

export async function getSubscription(subscriptionId: string): Promise<any> {
  return razorpayRequest('GET', `/subscriptions/${subscriptionId}`);
}

// Default credit packs (one-time purchases)
export const CREDIT_PACKS = [
  { id: 'cp_1000', name: 'Starter Pack', credits: 1000, priceINR: 99 },
  { id: 'cp_5000', name: 'Growth Pack', credits: 5000, priceINR: 399 },
  { id: 'cp_25000', name: 'Pro Pack', credits: 25000, priceINR: 1499 },
  { id: 'cp_100000', name: 'Scale Pack', credits: 100000, priceINR: 4999 },
];

// Subscription plans (monthly recurring)
export const SUBSCRIPTION_PLANS = [
  { id: 'plan_starter', name: 'Starter Monthly', creditsPerMonth: 30000, priceINR: 499 },
  { id: 'plan_pro', name: 'Pro Monthly', creditsPerMonth: 200000, priceINR: 1499 },
  { id: 'plan_scale', name: 'Scale Monthly', creditsPerMonth: 2500000, priceINR: 9499 },
];
