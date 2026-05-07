import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import type { CryptoEnv } from "~/lib/payments/crypto.server";
import { createCryptoInvoice } from "~/lib/payments/crypto.server";
import { coinBundles, paymentOrders } from "../../db/schema";

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: 3 crypto payment initiations per 10 min
  const rlKey = `rl:crypto:create:${user.id}`;
  const rl = await env.KV.get(rlKey);
  if (rl && Number(rl) >= 3) return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });
  await env.KV.put(rlKey, String((Number(rl ?? 0)) + 1), { expirationTtl: 600 });

  const form = await request.formData();
  const bundleId = form.get("bundleId") as string | null;
  if (!bundleId) return Response.json({ error: "Missing bundleId" }, { status: 400 });

  const db = createDb(env.DB);
  const bundle = await db.select().from(coinBundles).where(eq(coinBundles.id, bundleId)).get();
  if (!bundle || !bundle.isActive) return Response.json({ error: "Invalid bundle" }, { status: 400 });

  const orderId = crypto.randomUUID();
  const origin = new URL(request.url).origin;

  try {
    const ipnUrl = `${origin}/api/coins/crypto/webhook`;
    const invoice = await createCryptoInvoice(env as unknown as CryptoEnv, {
      orderId,
      priceAmountUsd: bundle.usdPriceCents / 100,
      description: `${bundle.coinAmount} Core Coins — ${bundle.name}`,
      successUrl: `${origin}/coins?crypto=success&order=${orderId}`,
      cancelUrl: `${origin}/coins?crypto=cancelled`,
      ipnCallbackUrl: ipnUrl,
    });

    await db.insert(paymentOrders).values({
      id: orderId,
      userId: user.id,
      bundleId,
      usdAmountCents: bundle.usdPriceCents,
      coinAmount: bundle.coinAmount,
      provider: "crypto",
      providerOrderId: invoice.paymentId,
      status: "pending",
      ipAddress: request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return Response.json({ paymentUrl: invoice.invoiceUrl });
  } catch (err) {
    console.error("Crypto create payment error:", err);
    return Response.json({ error: "Payment provider error. Please try again." }, { status: 502 });
  }
}
