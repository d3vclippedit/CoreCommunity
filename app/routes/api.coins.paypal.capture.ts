// Called after PayPal redirect back to site — captures payment server-side.
// Never trust query params alone; always verify with PayPal before crediting.

import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "~/lib/auth/user.server";
import { creditCoins } from "~/lib/coins.server";
import { createDb } from "~/lib/db/index";
import type { PayPalEnv } from "~/lib/payments/paypal.server";
import { captureOrder } from "~/lib/payments/paypal.server";
import { adminMoneyLogs, paymentOrders } from "../../db/schema";

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const orderId = form.get("orderId") as string | null;
  if (!orderId) return Response.json({ error: "Missing orderId" }, { status: 400 });

  const db = createDb(env.DB);
  const order = await db
    .select()
    .from(paymentOrders)
    .where(and(eq(paymentOrders.id, orderId), eq(paymentOrders.userId, user.id)))
    .get();

  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  if (order.status === "completed")
    return Response.json({ already: true, coinAmount: order.coinAmount });
  if (order.status !== "pending")
    return Response.json({ error: "Order cannot be captured" }, { status: 400 });
  if (!order.providerOrderId)
    return Response.json({ error: "No PayPal order ID" }, { status: 400 });

  try {
    const { captureId, status } = await captureOrder(
      env as unknown as PayPalEnv,
      order.providerOrderId,
    );

    if (status !== "COMPLETED") {
      await db
        .update(paymentOrders)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(paymentOrders.id, orderId));
      return Response.json({ error: "Payment not completed" }, { status: 402 });
    }

    // Credit coins atomically
    await db
      .update(paymentOrders)
      .set({
        status: "completed",
        providerTxId: captureId,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(paymentOrders.id, orderId));
    await creditCoins(
      db,
      user.id,
      order.coinAmount,
      "purchase",
      "payment_order",
      orderId,
      `PayPal purchase: ${order.coinAmount} coins`,
    );

    // Audit log
    await db.insert(adminMoneyLogs).values({
      id: crypto.randomUUID(),
      adminUserId: user.id,
      action: "paypal_purchase",
      targetUserId: user.id,
      amount: order.coinAmount,
      refId: orderId,
      note: `PayPal capture ${captureId}`,
      createdAt: new Date(),
    });

    return Response.json({ success: true, coinAmount: order.coinAmount });
  } catch (err) {
    console.error("PayPal capture error:", err);
    return Response.json(
      { error: "Capture failed. Contact support if money was charged." },
      { status: 502 },
    );
  }
}
