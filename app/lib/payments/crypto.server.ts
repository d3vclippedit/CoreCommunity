// NOWPayments crypto integration (https://nowpayments.io)
//
// Required secrets — set with wrangler:
//   wrangler secret put NOWPAYMENTS_API_KEY
//   wrangler secret put NOWPAYMENTS_IPN_SECRET
//
// Supports: BTC, ETH, LTC, USDT, DOGE, and 300+ others
// Users select currency at checkout; we always price in USD.

export interface CryptoEnv {
  NOWPAYMENTS_API_KEY: string;
  NOWPAYMENTS_IPN_SECRET: string;
}

const BASE = "https://api.nowpayments.io/v1";

export async function createCryptoPayment(
  env: CryptoEnv,
  orderId: string,
  usdAmountCents: number,
  payCurrency: string,
  ipnCallbackUrl: string,
): Promise<{
  paymentId: string;
  payAddress: string;
  payAmount: number;
  payCurrency: string;
  paymentStatus: string;
}> {
  const res = await fetch(`${BASE}/payment`, {
    method: "POST",
    headers: {
      "x-api-key": env.NOWPAYMENTS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      price_amount: usdAmountCents / 100,
      price_currency: "usd",
      pay_currency: payCurrency.toLowerCase(),
      order_id: orderId,
      order_description: "Core Coins",
      ipn_callback_url: ipnCallbackUrl,
      is_fixed_rate: false,
      is_fee_paid_by_user: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NOWPayments create failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    payment_id: string;
    pay_address: string;
    pay_amount: number;
    pay_currency: string;
    payment_status: string;
  };

  return {
    paymentId: String(data.payment_id),
    payAddress: data.pay_address,
    payAmount: data.pay_amount,
    payCurrency: data.pay_currency,
    paymentStatus: data.payment_status,
  };
}

// Creates a hosted NOWPayments invoice page (user selects currency + pays there)
export async function createCryptoInvoice(
  env: CryptoEnv,
  opts: {
    orderId: string;
    priceAmountUsd: number;
    description: string;
    successUrl: string;
    cancelUrl: string;
    ipnCallbackUrl: string;
  },
): Promise<{ invoiceId: string; invoiceUrl: string; paymentId: string }> {
  const res = await fetch(`${BASE}/invoice`, {
    method: "POST",
    headers: {
      "x-api-key": env.NOWPAYMENTS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      price_amount: opts.priceAmountUsd,
      price_currency: "usd",
      order_id: opts.orderId,
      order_description: opts.description,
      ipn_callback_url: opts.ipnCallbackUrl,
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NOWPayments invoice create failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    id: string;
    invoice_url: string;
    payment_id?: string;
  };

  return {
    invoiceId: String(data.id),
    invoiceUrl: data.invoice_url,
    paymentId: String(data.payment_id ?? data.id),
  };
}

export async function getPaymentStatus(
  env: CryptoEnv,
  paymentId: string,
): Promise<{ status: string; actually_paid: number }> {
  const res = await fetch(`${BASE}/payment/${paymentId}`, {
    headers: { "x-api-key": env.NOWPAYMENTS_API_KEY },
  });
  if (!res.ok) throw new Error(`NOWPayments status check failed: ${res.status}`);
  const data = (await res.json()) as { payment_status: string; actually_paid: number };
  return { status: data.payment_status, actually_paid: data.actually_paid };
}

export async function getAvailableCurrencies(env: CryptoEnv): Promise<string[]> {
  try {
    const res = await fetch(`${BASE}/currencies?fixed_rate=false`, {
      headers: { "x-api-key": env.NOWPAYMENTS_API_KEY },
    });
    if (!res.ok) return ["btc", "eth", "ltc", "usdt", "doge"];
    const data = (await res.json()) as { currencies: string[] };
    return data.currencies.slice(0, 20);
  } catch {
    return ["btc", "eth", "ltc", "usdt", "doge"];
  }
}

// HMAC-SHA512 IPN signature verification
export async function verifyIpnSignature(
  env: CryptoEnv,
  rawBody: string,
  sigHeader: string,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(env.NOWPAYMENTS_IPN_SECRET),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
    const hex = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return hex === sigHeader;
  } catch {
    return false;
  }
}

// NOWPayments "finished" statuses that mean payment is confirmed
export function isPaymentFinished(status: string): boolean {
  return ["finished", "confirmed", "sending", "partially_paid"].includes(status);
}

export function isPaymentFailed(status: string): boolean {
  return ["failed", "refunded", "expired"].includes(status);
}
