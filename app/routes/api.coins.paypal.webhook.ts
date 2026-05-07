// PayPal IPN webhook — server-side payment confirmation (backup to capture flow)
// Idempotent: duplicate events are silently ignored via unique index on event_id.

import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { eq } from "drizzle-orm";
import { creditCoins } from "~/lib/coins.server";
import { createDb } from "~/lib/db/index";
import type { PayPalEnv } from "~/lib/payments/paypal.server";
import { verifyWebhookSignature } from "~/lib/payments/paypal.server";
import { adminMoneyLogs, paymentOrders, paymentWebhookEvents } from "../../db/schema";

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const rawBody = await request.text();

  // 1. Verify signature before doing anything
  const isValid = await verifyWebhookSignature(
    env as unknown as PayPalEnv,
    request.headers,
    rawBody,
  );
  if (!isValid) {
    console.error("PayPal webhook: invalid signature");
    return new Response("Forbidden", { status: 403 });
  }

  let event: { id: string; event_type: string; resource: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const db = createDb(env.DB);
  const eventId = event.id;

  // 2. Idempotency check — ignore duplicates
  const existing = await db
    .select({ processed: paymentWebhookEvents.processed })
    .from(paymentWebhookEvents)
    .where(eq(paymentWebhookEvents.eventId, eventId))
    .get();

  if (existing?.processed) return new Response("Already processed", { status: 200 });

  // 3. Record event
  const webhookRowId = crypto.randomUUID();
  try {
    await db.insert(paymentWebhookEvents).values({
      id: webhookRowId,
      provider: "paypal",
      eventId,
      eventType: event.event_type,
      payload: rawBody,
      processed: false,
      createdAt: new Date(),
    });
  } catch {
    // Unique constraint hit = already recorded (race condition) — safe to continue
  }

  // 4. Handle event types
  try {
    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      const resource = event.resource as {
        id: string;
        custom_id?: string;
        supplementary_data?: { related_ids?: { order_id?: string } };
      };
      const providerOrderId = resource.supplementary_data?.related_ids?.order_id ?? "";
      const captureId = resource.id;

      const order = await db
        .select()
        .from(paymentOrders)
        .where(eq(paymentOrders.providerOrderId, providerOrderId))
        .get();

      if (order && order.status === "pending") {
        await db
          .update(paymentOrders)
          .set({
            status: "completed",
            providerTxId: captureId,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(paymentOrders.id, order.id));
        await creditCoins(
          db,
          order.userId,
          order.coinAmount,
          "purchase",
          "payment_order",
          order.id,
          `PayPal webhook: ${order.coinAmount} coins`,
        );
        await db.insert(adminMoneyLogs).values({
          id: crypto.randomUUID(),
          adminUserId: order.userId,
          action: "paypal_webhook_credit",
          targetUserId: order.userId,
          amount: order.coinAmount,
          refId: order.id,
          note: `webhook event ${eventId}`,
          createdAt: new Date(),
        });
      }
    } else if (event.event_type === "PAYMENT.CAPTURE.REFUNDED") {
      const resource = event.resource as { id: string };
      await db
        .update(paymentOrders)
        .set({ status: "refunded", updatedAt: new Date() })
        .where(eq(paymentOrders.providerTxId, resource.id));
    }

    // Mark processed
    await db
      .update(paymentWebhookEvents)
      .set({ processed: true })
      .where(eq(paymentWebhookEvents.id, webhookRowId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(paymentWebhookEvents)
      .set({ error: msg })
      .where(eq(paymentWebhookEvents.id, webhookRowId));
    console.error("PayPal webhook processing error:", err);
  }

  return new Response("OK", { status: 200 });
}
