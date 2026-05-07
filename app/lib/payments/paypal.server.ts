// PayPal REST API v2 integration
//
// Required secrets — set with wrangler:
//   wrangler secret put PAYPAL_CLIENT_ID
//   wrangler secret put PAYPAL_CLIENT_SECRET
//   wrangler secret put PAYPAL_WEBHOOK_ID
//   wrangler secret put PAYPAL_ENV   (value: "sandbox" or "live")
//
// Docs: https://developer.paypal.com/docs/api/orders/v2/

export interface PayPalEnv {
  PAYPAL_CLIENT_ID: string;
  PAYPAL_CLIENT_SECRET: string;
  PAYPAL_WEBHOOK_ID: string;
  PAYPAL_ENV: "sandbox" | "live";
}

function baseUrl(env: PayPalEnv): string {
  return env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function getAccessToken(env: PayPalEnv): Promise<string> {
  const creds = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
  const res = await fetch(`${baseUrl(env)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function createOrder(
  env: PayPalEnv,
  orderId: string,
  usdAmountCents: number,
  description: string,
  returnUrl: string,
  cancelUrl: string,
): Promise<{ id: string; approvalUrl: string }> {
  const token = await getAccessToken(env);
  const amount = (usdAmountCents / 100).toFixed(2);

  const res = await fetch(`${baseUrl(env)}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": orderId, // idempotency key
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: orderId,
          description,
          amount: { currency_code: "USD", value: amount },
        },
      ],
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
        brand_name: "CORE",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal create order failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { id: string; links: { rel: string; href: string }[] };
  const approvalUrl = data.links.find((l) => l.rel === "approve")?.href ?? "";
  return { id: data.id, approvalUrl };
}

export async function captureOrder(
  env: PayPalEnv,
  paypalOrderId: string,
): Promise<{ captureId: string; status: string }> {
  const token = await getAccessToken(env);
  const res = await fetch(`${baseUrl(env)}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal capture failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as {
    status: string;
    purchase_units: { payments: { captures: { id: string; status: string }[] } }[];
  };
  const capture = data.purchase_units[0]?.payments?.captures?.[0];
  return { captureId: capture?.id ?? "", status: data.status };
}

// Verify PayPal webhook signature
// Returns true if the webhook is authentic.
export async function verifyWebhookSignature(
  env: PayPalEnv,
  headers: Headers,
  rawBody: string,
): Promise<boolean> {
  // ⚠️ PLACEHOLDER — replace with PayPal's certificate-based verification
  // See: https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature
  // For now, verify using PayPal's verify-webhook-signature API endpoint:
  const token = await getAccessToken(env);

  const payload = {
    auth_algo: headers.get("PAYPAL-AUTH-ALGO") ?? "",
    cert_url: headers.get("PAYPAL-CERT-URL") ?? "",
    transmission_id: headers.get("PAYPAL-TRANSMISSION-ID") ?? "",
    transmission_sig: headers.get("PAYPAL-TRANSMISSION-SIG") ?? "",
    transmission_time: headers.get("PAYPAL-TRANSMISSION-TIME") ?? "",
    webhook_id: env.PAYPAL_WEBHOOK_ID,
    webhook_event: JSON.parse(rawBody),
  };

  try {
    const res = await fetch(`${baseUrl(env)}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { verification_status: string };
    return data.verification_status === "SUCCESS";
  } catch {
    return false;
  }
}
