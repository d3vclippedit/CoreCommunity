import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { eq } from "drizzle-orm";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { getCurrentUser } from "~/lib/auth/user.server";
import { creditCoins, debitCoins } from "~/lib/coins.server";
import { createDb } from "~/lib/db/index";
import { coinBundles, postBadgeDefinitions, users } from "../../db/schema";

export const meta: MetaFunction = () => [{ title: "Admin — CORE" }];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user?.isPlatformAdmin) throw new Response("Forbidden", { status: 403 });

  const db = createDb(env.DB);
  const [bundles, badgeDefs] = await Promise.all([
    db.select().from(coinBundles).orderBy(coinBundles.usdPriceCents),
    db.select().from(postBadgeDefinitions).orderBy(postBadgeDefinitions.displayOrder),
  ]);

  return { user, bundles, badgeDefs };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const currentUser = await getCurrentUser(request, env);
  if (!currentUser?.isPlatformAdmin) throw new Response("Forbidden", { status: 403 });

  const form = await request.formData();
  const intent = (form.get("intent") as string | null) ?? "";
  const db = createDb(env.DB);

  if (intent === "verify" || intent === "unverify") {
    const handle = (form.get("handle") as string | null)?.trim().toLowerCase() ?? "";
    if (!handle) return { error: "Handle is required." };
    const target = await db.query.users.findFirst({ where: eq(users.handle, handle), columns: { id: true, handle: true } });
    if (!target) return { error: `No user found with handle @${handle}.` };
    await db.update(users).set({ isVerifiedStreamer: intent === "verify" }).where(eq(users.id, target.id));
    return { ok: true, msg: `@${target.handle} is now ${intent === "verify" ? "verified ✓" : "unverified"}.` };
  }

  if (intent === "coin_credit" || intent === "coin_debit") {
    const handle = (form.get("coinHandle") as string | null)?.trim().toLowerCase() ?? "";
    const amount = Number(form.get("coinAmount") ?? 0);
    const note = (form.get("coinNote") as string | null)?.trim() ?? "";
    if (!handle || !amount || amount <= 0) return { error: "Handle and positive amount are required." };
    const target = await db.query.users.findFirst({ where: eq(users.handle, handle), columns: { id: true, handle: true } });
    if (!target) return { error: `No user found with handle @${handle}.` };
    try {
      if (intent === "coin_credit") {
        await creditCoins(db, target.id, amount, "admin_credit", "admin", currentUser.id, note || `Admin credit by ${currentUser.handle}`);
      } else {
        await debitCoins(db, target.id, amount, "admin_debit", "admin", currentUser.id, note || `Admin debit by ${currentUser.handle}`);
      }
      return { ok: true, msg: `${intent === "coin_credit" ? "Credited" : "Debited"} ${amount} coins ${intent === "coin_credit" ? "to" : "from"} @${target.handle}.` };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Failed." };
    }
  }

  if (intent === "bundle_toggle") {
    const bundleId = form.get("bundleId") as string | null;
    if (!bundleId) return { error: "Missing bundleId." };
    const bundle = await db.select({ isActive: coinBundles.isActive }).from(coinBundles).where(eq(coinBundles.id, bundleId)).get();
    if (!bundle) return { error: "Bundle not found." };
    await db.update(coinBundles).set({ isActive: !bundle.isActive }).where(eq(coinBundles.id, bundleId));
    return { ok: true, msg: `Bundle ${bundle.isActive ? "deactivated" : "activated"}.` };
  }

  if (intent === "badge_toggle") {
    const badgeId = form.get("badgeId") as string | null;
    if (!badgeId) return { error: "Missing badgeId." };
    const badge = await db.select({ isActive: postBadgeDefinitions.isActive }).from(postBadgeDefinitions).where(eq(postBadgeDefinitions.id, badgeId)).get();
    if (!badge) return { error: "Badge not found." };
    await db.update(postBadgeDefinitions).set({ isActive: !badge.isActive }).where(eq(postBadgeDefinitions.id, badgeId));
    return { ok: true, msg: `Badge ${badge.isActive ? "deactivated" : "activated"}.` };
  }

  return { error: "Unknown action." };
}

export default function AdminPage() {
  const { user, bundles, badgeDefs } = useLoaderData<typeof loader>();
  const data = useActionData<typeof action>();
  const nav = useNavigation();
  const submitting = nav.state === "submitting";

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header user={user} />
      <AppShell>
        <div className="py-6 max-w-lg">
          <h1 className="text-xl font-semibold mb-6" style={{ color: "var(--color-text)" }}>
            Platform Admin
          </h1>

          <div
            className="rounded-lg p-5"
            style={{
              background: "var(--color-bg-elev-1)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text)" }}>
              Verified Streamer Badge
            </h2>

            {data && "error" in data && (
              <p className="text-sm mb-3" style={{ color: "var(--color-danger)" }}>
                {data.error}
              </p>
            )}
            {data && "ok" in data && (
              <p className="text-sm mb-3" style={{ color: "var(--color-success)" }}>
                {data.msg}
              </p>
            )}

            <Form method="post" className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="handle"
                  className="text-xs font-medium"
                  style={{ color: "var(--color-text-dim)" }}
                >
                  Handle (without @)
                </label>
                <input
                  id="handle"
                  name="handle"
                  type="text"
                  placeholder="streamer_handle"
                  required
                  autoComplete="off"
                  className="w-full rounded-md px-3 py-2 text-sm"
                  style={{
                    background: "var(--color-bg-elev-2)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                    outline: "none",
                  }}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  name="intent"
                  value="verify"
                  disabled={submitting}
                  className="px-4 py-1.5 text-sm font-medium rounded-md disabled:opacity-60"
                  style={{ background: "var(--color-success)", color: "#000" }}
                >
                  {submitting ? "…" : "Grant badge"}
                </button>
                <button
                  type="submit"
                  name="intent"
                  value="unverify"
                  disabled={submitting}
                  className="px-4 py-1.5 text-sm font-medium rounded-md disabled:opacity-60"
                  style={{
                    background: "var(--color-bg-elev-2)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-dim)",
                  }}
                >
                  {submitting ? "…" : "Remove badge"}
                </button>
              </div>
            </Form>
          </div>

          {/* Coin management */}
          <div
            className="rounded-lg p-5 mt-6"
            style={{ background: "var(--color-bg-elev-1)", border: "1px solid var(--color-border)" }}
          >
            <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text)" }}>
              Adjust User Coins
            </h2>
            <Form method="post" className="flex flex-col gap-3">
              <input
                name="coinHandle"
                type="text"
                placeholder="Handle (without @)"
                required
                className="w-full rounded-md px-3 py-2 text-sm"
                style={{ background: "var(--color-bg-elev-2)", border: "1px solid var(--color-border)", color: "var(--color-text)", outline: "none" }}
              />
              <input
                name="coinAmount"
                type="number"
                placeholder="Amount (coins)"
                min={1}
                required
                className="w-full rounded-md px-3 py-2 text-sm"
                style={{ background: "var(--color-bg-elev-2)", border: "1px solid var(--color-border)", color: "var(--color-text)", outline: "none" }}
              />
              <input
                name="coinNote"
                type="text"
                placeholder="Note (optional)"
                className="w-full rounded-md px-3 py-2 text-sm"
                style={{ background: "var(--color-bg-elev-2)", border: "1px solid var(--color-border)", color: "var(--color-text)", outline: "none" }}
              />
              <div className="flex gap-2">
                <button type="submit" name="intent" value="coin_credit" disabled={submitting}
                  className="px-4 py-1.5 text-sm font-medium rounded-md disabled:opacity-60"
                  style={{ background: "var(--color-success)", color: "#000" }}>
                  Credit
                </button>
                <button type="submit" name="intent" value="coin_debit" disabled={submitting}
                  className="px-4 py-1.5 text-sm font-medium rounded-md disabled:opacity-60"
                  style={{ background: "var(--color-danger)", color: "#fff" }}>
                  Debit
                </button>
              </div>
            </Form>
          </div>

          {/* Bundle management */}
          <div
            className="rounded-lg p-5 mt-6"
            style={{ background: "var(--color-bg-elev-1)", border: "1px solid var(--color-border)" }}
          >
            <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text)" }}>
              Coin Bundles
            </h2>
            <div className="flex flex-col gap-2">
              {bundles.map((b) => (
                <div key={b.id} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--color-text-dim)" }}>
                    {b.name} — {b.coinAmount} cc — ${(b.usdPriceCents / 100).toFixed(2)}
                  </span>
                  <Form method="post">
                    <input type="hidden" name="bundleId" value={b.id} />
                    <button type="submit" name="intent" value="bundle_toggle"
                      className="text-xs px-3 py-1 rounded-md"
                      style={{ background: "var(--color-bg-elev-2)", border: "1px solid var(--color-border)", color: b.isActive ? "var(--color-success)" : "var(--color-text-faint)" }}>
                      {b.isActive ? "Active" : "Inactive"}
                    </button>
                  </Form>
                </div>
              ))}
            </div>
          </div>

          {/* Badge definition management */}
          <div
            className="rounded-lg p-5 mt-6"
            style={{ background: "var(--color-bg-elev-1)", border: "1px solid var(--color-border)" }}
          >
            <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text)" }}>
              Badge Definitions
            </h2>
            <div className="flex flex-col gap-2">
              {badgeDefs.map((b) => (
                <div key={b.id} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--color-text-dim)" }}>
                    {b.icon} {b.name} — {b.coinCost} cc
                  </span>
                  <Form method="post">
                    <input type="hidden" name="badgeId" value={b.id} />
                    <button type="submit" name="intent" value="badge_toggle"
                      className="text-xs px-3 py-1 rounded-md"
                      style={{ background: "var(--color-bg-elev-2)", border: "1px solid var(--color-border)", color: b.isActive ? "var(--color-success)" : "var(--color-text-faint)" }}>
                      {b.isActive ? "Active" : "Inactive"}
                    </button>
                  </Form>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AppShell>
      <Footer />
    </div>
  );
}
