import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import type { PayPalEnv } from "~/lib/payments/paypal.server";
import { createOrder } from "~/lib/payments/paypal.server";
import { coinBundles, paymentOrders } from "../../db/schema";

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: 5 payment initiations per 10 min
  const rlKey = `rl:paypal:create:${user.id}`;
  const rl = await env.KV.get(rlKey);
  if (rl && Number(rl) >= 5)
    return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });
  await env.KV.put(rlKey, String(Number(rl ?? 0) + 1), { expirationTtl: 600 });

  const form = await request.formData();
  const bundleId = form.get("bundleId") as string | null;
  if (!bundleId) return Response.json({ error: "Missing bundleId" }, { status: 400 });

  const db = createDb(env.DB);
  const bundle = await db.select().from(coinBundles).where(eq(coinBundles.id, bundleId)).get();
  if (!bundle || !bundle.isActive)
    return Response.json({ error: "Invalid bundle" }, { status: 400 });

  const orderId = crypto.randomUUID();
  const origin = new URL(request.url).origin;

  const paypalEnv = (env as unknown as PayPalEnv).PAYPAL_ENV;
  console.log("[paypal/create] PAYPAL_ENV present:", !!paypalEnv, "value:", paypalEnv);

  try {
    const { id: providerOrderId, approvalUrl } = await createOrder(
      env as unknown as PayPalEnv,
      orderId,
      bundle.usdPriceCents,
      `${bundle.coinAmount} Core Coins — ${bundle.name}`,
      `${origin}/coins?paypal=success&order=${orderId}`,
      `${origin}/coins?paypal=cancelled`,
    );

    // Store order before redirecting — never trust the return URL alone
    await db.insert(paymentOrders).values({
      id: orderId,
      userId: user.id,
      bundleId,
      usdAmountCents: bundle.usdPriceCents,
      coinAmount: bundle.coinAmount,
      provider: "paypal",
      providerOrderId,
      status: "pending",
      ipAddress:
        request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return Response.json({ approvalUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[paypal/create] Error:", msg);
    return Response.json({ error: `PayPal error: ${msg}` }, { status: 502 });
  }
}
