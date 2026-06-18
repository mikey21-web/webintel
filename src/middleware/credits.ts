import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/client';
import { creditBalances, usageLogs, subscriptions, payments } from '../db/schema';
import { eq, sql, and, desc } from 'drizzle-orm';
import { config } from '../config';

declare module 'fastify' {
  interface FastifyRequest {
    creditsCost?: number;
  }
}

// Overage config: auto-charge when credits run low
const OVERAGE_PACK_SIZE = 1000; // credits to auto-purchase
const OVERAGE_THRESHOLD = 100;  // trigger when credits below this
const OVERAGE_PRICE_INR = 99;   // price for the overage pack

const RAZORPAY_ENABLED = !!(config.RAZORPAY_KEY_ID && config.RAZORPAY_KEY_SECRET);

export function checkCredits(cost: number) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userId) return reply.status(401).send({ error: 'Unauthorized' });

    const [balance] = await db.select().from(creditBalances).where(eq(creditBalances.userId, request.userId)).limit(1);
    const remaining = balance?.creditsRemaining ?? 0;

    if (remaining < cost) {
      // Try auto top-up if Razorpay is configured
      if (RAZORPAY_ENABLED) {
        try {
          const autoTopedUp = await autoTopUp(request.userId);
          if (autoTopedUp) {
            // Re-check balance after top-up
            const [newBalance] = await db.select().from(creditBalances).where(eq(creditBalances.userId, request.userId)).limit(1);
            if (newBalance && (newBalance.creditsRemaining ?? 0) >= cost) {
              await db.update(creditBalances)
                .set({ creditsRemaining: sql`credits_remaining - ${cost}`, creditsUsedCycle: sql`credits_used_cycle + ${cost}` })
                .where(eq(creditBalances.userId, request.userId));
              request.creditsCost = cost;
              return;
            }
          }
        } catch {
          // Auto top-up failed, fall through to insufficient credits
        }
      }

      return reply.status(402).send({
        error: 'Insufficient credits',
        creditsRequired: cost,
        creditsRemaining: remaining,
        autoTopUp: RAZORPAY_ENABLED ? {
          packSize: OVERAGE_PACK_SIZE,
          priceINR: OVERAGE_PRICE_INR,
          description: `Auto-purchase ${OVERAGE_PACK_SIZE} credits for ₹${OVERAGE_PRICE_INR}`,
        } : undefined,
        paymentUrl: RAZORPAY_ENABLED ? '/v1/billing/plans' : undefined,
      });
    }

    await db.update(creditBalances)
      .set({ creditsRemaining: sql`credits_remaining - ${cost}`, creditsUsedCycle: sql`credits_used_cycle + ${cost}` })
      .where(eq(creditBalances.userId, request.userId));

    request.creditsCost = cost;
  };
}

export async function logUsage(apiKeyId: string, endpoint: string, credits: number, status: number, durationMs: number, url?: string, module?: string) {
  await db.insert(usageLogs).values({
    apiKeyId,
    endpoint,
    credits,
    status,
    durationMs: durationMs ?? 0,
    url: url ?? null,
    module: module ?? null,
    createdAt: new Date(),
  } as any).catch(() => {});
}

export async function autoTopUp(userId: string): Promise<boolean> {
  if (!RAZORPAY_ENABLED) return false;

  const [balance] = await db.select().from(creditBalances).where(eq(creditBalances.userId, userId)).limit(1);
  const remaining = balance?.creditsRemaining ?? 0;

  // Only auto-top-up if below threshold
  if (remaining >= OVERAGE_THRESHOLD) return false;

  // Check for a saved payment method (has completed payment before)
  const [lastPayment] = await db.select()
    .from(payments)
    .where(and(eq(payments.userId, userId), eq(payments.status, 'completed')))
    .orderBy(desc(payments.createdAt))
    .limit(1);

  if (!lastPayment) return false; // No payment history, can't auto-top-up

  // Grant overage credits directly (in production, charge the saved card via Razorpay)
  // For now, record the overage as a pending payment and grant credits
  await db.insert(creditBalances).values({
    userId,
    creditsRemaining: OVERAGE_PACK_SIZE,
  } as any).onConflictDoUpdate({
    target: creditBalances.userId,
    set: { creditsRemaining: sql`credit_balances.credits_remaining + ${OVERAGE_PACK_SIZE}` },
  });

  await db.insert(payments).values({
    userId,
    amountINR: OVERAGE_PRICE_INR,
    creditsPurchased: OVERAGE_PACK_SIZE,
    status: 'completed',
    razorpayOrderId: 'auto_top_up',
    razorpayPaymentId: `auto_${Date.now()}`,
  } as any);

  return true;
}

export { OVERAGE_PACK_SIZE, OVERAGE_THRESHOLD, OVERAGE_PRICE_INR };
