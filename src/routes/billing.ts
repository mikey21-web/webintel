import { FastifyInstance } from 'fastify';
import { db } from '../db/client';
import { billingPlans, subscriptions, payments, creditBalances } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import {
  razorpayEnabled, createOrder, createSubscription, createPlan, verifyPayment,
  verifyWebhookSignature, getPayment, CREDIT_PACKS, SUBSCRIPTION_PLANS,
} from '../billing/razorpay';
import { config } from '../config';
import { sanitizeError } from '../utils/errors';

export async function billingRoutes(app: FastifyInstance) {
  app.get('/plans', async () => {
    return {
      creditPacks: CREDIT_PACKS,
      subscriptionPlans: SUBSCRIPTION_PLANS,
      currency: 'INR',
      enabled: razorpayEnabled(),
    };
  });

  app.post<{ Body: { packId: string } }>(
    '/create-order',
    { preHandler: [requireAuth, rateLimit()] },
    async (request, reply) => {
      const { packId } = request.body;
      const pack = CREDIT_PACKS.find(p => p.id === packId);
      if (!pack) return reply.status(400).send({ error: 'Invalid pack ID' });

      if (!razorpayEnabled()) {
        return reply.status(503).send({ error: 'Payments not configured' });
      }

      try {
        const order = await createOrder(pack.priceINR, `credits_${packId}_${request.userId}`, {
          userId: request.userId!,
          packId: pack.id,
          credits: String(pack.credits),
        });

        await db.insert(payments).values({
          userId: request.userId!,
          razorpayOrderId: order.id,
          amountINR: pack.priceINR,
          creditsPurchased: pack.credits,
          status: 'pending',
        } as any);

        return {
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
          keyId: config.RAZORPAY_KEY_ID,
          name: pack.name,
          description: `${pack.credits.toLocaleString()} credits`,
        };
      } catch (err: any) {
        return reply.status(500).send({ error: `Failed to create order: ${sanitizeError(err)}` });
      }
    },
  );

  app.post<{ Body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string } }>(
    '/verify-payment',
    { preHandler: [requireAuth, rateLimit()] },
    async (request, reply) => {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = request.body;

      try {
        const [existingPayment] = await db.select().from(payments).where(eq(payments.razorpayPaymentId, razorpay_payment_id)).limit(1);
        if (existingPayment) return reply.status(200).send({ status: 'ok', creditsGranted: 0, amountINR: 0, alreadyProcessed: true });

        const isValid = await verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
        if (!isValid) return reply.status(400).send({ error: 'Invalid payment signature' });

        const paymentInfo = await getPayment(razorpay_payment_id);
        const amountINR = Math.round(paymentInfo.amount / 100);
        const matchingPack = CREDIT_PACKS.find(p => p.priceINR === amountINR);
        const credits = matchingPack?.credits || Math.round(amountINR * 10);

        await db.insert(creditBalances).values({
          userId: request.userId!,
          creditsRemaining: credits,
          creditsUsedCycle: 0,
        } as any).onConflictDoUpdate({
          target: creditBalances.userId,
          set: { creditsRemaining: sql`credit_balances.credits_remaining + ${credits}` },
        });

        await db.insert(payments).values({
          userId: request.userId!,
          razorpayPaymentId: razorpay_payment_id,
          razorpayOrderId: razorpay_order_id,
          amountINR,
          creditsPurchased: credits,
          status: 'completed',
        } as any);

        return { status: 'ok', creditsGranted: credits, amountINR };
      } catch (err: any) {
        return reply.status(500).send({ error: `Payment verification failed: ${sanitizeError(err)}` });
      }
    },
  );

  app.post<{ Body: { planId: string } }>(
    '/create-subscription',
    { preHandler: [requireAuth, rateLimit()] },
    async (request, reply) => {
      const { planId } = request.body;
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
      if (!plan) return reply.status(400).send({ error: 'Invalid plan ID' });

      if (!razorpayEnabled()) {
        return reply.status(503).send({ error: 'Payments not configured' });
      }

      try {
        const razorpayPlan = await createPlan(
          plan.name,
          plan.priceINR,
          'monthly',
          plan.creditsPerMonth,
        );

        const subscription = await createSubscription(
          razorpayPlan.id,
          request.userId!,
        );

        await db.insert(subscriptions).values({
          userId: request.userId!,
          planId,
          razorpaySubscriptionId: subscription.id,
          razorpayOrderId: '',
          status: 'created',
          creditsGranted: plan.creditsPerMonth,
          currentPeriodStart: new Date(),
        } as any);

        return {
          subscriptionId: subscription.id,
          shortUrl: subscription.short_url,
          planName: plan.name,
        };
      } catch (err: any) {
        return reply.status(500).send({ error: `Failed to create subscription: ${sanitizeError(err)}` });
      }
    },
  );

  app.post('/razorpay-webhook', async (request, reply) => {
    try {
      const signature = request.headers['x-razorpay-signature'] as string;
      const body = JSON.stringify(request.body);

      if (!verifyWebhookSignature(body, signature)) {
        return reply.status(400).send({ error: 'Invalid webhook signature' });
      }

      const event = request.body as any;

      switch (event.event) {
        case 'payment.captured': {
          const payment = event.payload.payment.entity;
          const orderId = payment.order_id;
          const paymentId = payment.id;
          const amountINR = Math.round(payment.amount / 100);

          const userId = payment.notes?.userId;
          if (userId) {
            const creditsStr = payment.notes?.credits;
            let credits = creditsStr ? parseInt(creditsStr, 10) : Math.round(amountINR * 10);
            if (isNaN(credits)) credits = Math.round(amountINR * 10);
            await db.insert(creditBalances).values({
              userId,
              creditsRemaining: credits,
            } as any).onConflictDoUpdate({
              target: creditBalances.userId,
              set: { creditsRemaining: sql`credit_balances.credits_remaining + ${credits}` },
            });
          }
          break;
        }

        case 'subscription.charged': {
          const sub = event.payload.subscription.entity;
          const subId = sub.id;
          const credits = parseInt(sub.notes?.credits || '30000', 10);

          const [existingSub] = await db.select()
            .from(subscriptions)
            .where(eq(subscriptions.razorpaySubscriptionId, subId))
            .limit(1);

          if (existingSub) {
            await db.insert(creditBalances).values({
              userId: existingSub.userId,
              creditsRemaining: credits,
            } as any).onConflictDoUpdate({
              target: creditBalances.userId,
              set: { creditsRemaining: sql`credit_balances.credits_remaining + ${credits}` },
            });
          }
          break;
        }
      }

      return reply.send({ status: 'ok' });
    } catch (err: any) {
      return reply.status(500).send({ error: sanitizeError(err) });
    }
  });

  app.get('/balance', { preHandler: [requireAuth, rateLimit()] }, async (request) => {
    const [balance] = await db.select()
      .from(creditBalances)
      .where(eq(creditBalances.userId, request.userId!))
      .limit(1);

    return {
      creditsRemaining: balance?.creditsRemaining ?? 0,
      creditsUsedCycle: balance?.creditsUsedCycle ?? 0,
      resetAt: balance?.resetAt,
    };
  });

  app.get('/history', { preHandler: [requireAuth, rateLimit()] }, async (request) => {
    const history = await db.select()
      .from(payments)
      .where(eq(payments.userId, request.userId!))
      .orderBy(payments.createdAt)
      .limit(50);

    return history;
  });
}
