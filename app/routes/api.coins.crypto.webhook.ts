// NOWPayments IPN webhook — server-side payment confirmation.
// Idempotent: duplicate events silently ignored via unique index on event_id.

import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { eq } from "drizzle-orm";
import { creditCoins } from "~/lib/coins.server";
import { createDb } from "~/lib/db/index";
import type { CryptoEnv } from "~/lib/payments/crypto.server";
import { isPaymentFinished, verifyIpnSignature } from "~/lib/payments/crypto.server";
import { adminMoneyLogs, paymentOrders, paymentWebhookEvents } from "../../db/schema";

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const rawBody = await request.text();

  const sigHeader = request.headers.get("x-nowpayments-sig") ?? "";
  const isValid = await verifyIpnSignature(env as unknown as CryptoEnv, rawBody, sigHeader);
  if (!isValid) {
    console.error("Crypto webhook: invalid signature");
    return new Response("Forbidden", { status: 403 });
  }

  let event: { payment_id: string; payment_status: string; order_id?: string; price_amount?: number; pay_amount?: number; pay_currency?: string };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const db = createDb(env.DB);
  const eventId = String(event.payment_id);

  const existing = await db
    .select({ processed: paymentWebhookEvents.processed })
    .from(paymentWebhookEvents)
    .where(eq(paymentWebhookEvents.eventId, eventId))
    .get();

  if (existing?.processed) return new Response("Already processed", { status: 200 });

  const webhookRowId = crypto.randomUUID();
  try {
    await db.insert(paymentWebhookEvents).values({
      id: webhookRowId,
      provider: "crypto",
      eventId,
      eventType: event.payment_status,
      payload: rawBody,
      processed: false,
      createdAt: new Date(),
    });
  } catch {
    // Unique constraint = already recorded (race) — safe to continue
  }

  try {
    if (isPaymentFinished(event.payment_status)) {
      const orderId = event.order_id ?? "";
      const order = await db
        .select()
        .from(paymentOrders)
        .where(eq(paymentOrders.id, orderId))
        .get();

      if (order && order.status === "pending") {
        await db.update(paymentOrders).set({ status: "completed", providerTxId: eventId, completedAt: new Date(), updatedAt: new Date() }).where(eq(paymentOrders.id, order.id));
        await creditCoins(db, order.userId, order.coinAmount, "purchase", "payment_order", order.id, `Crypto webhook: ${order.coinAmount} coins`);
        await db.insert(adminMoneyLogs).values({
          id: crypto.randomUUID(),
          adminUserId: order.userId,
          action: "crypto_webhook_credit",
          targetUserId: order.userId,
          amount: order.coinAmount,
          refId: order.id,
          note: `IPN event ${eventId} status=${event.payment_status}`,
          createdAt: new Date(),
        });
      }
    }

    await db.update(paymentWebhookEvents).set({ processed: true }).where(eq(paymentWebhookEvents.id, webhookRowId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.update(paymentWebhookEvents).set({ error: msg }).where(eq(paymentWebhookEvents.id, webhookRowId));
    console.error("Crypto webhook processing error:", err);
  }

  return new Response("OK", { status: 200 });
}
