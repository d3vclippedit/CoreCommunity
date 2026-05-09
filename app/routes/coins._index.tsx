import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { useFetcher, useLoaderData, useRouteLoaderData, useSearchParams } from "@remix-run/react";
import { and, eq, isNull } from "drizzle-orm";
import { type FormEvent, useEffect, useState } from "react";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { getCurrentUser } from "~/lib/auth/user.server";
import { formatCoins } from "~/lib/coins";
import { getActiveBundles, getBalance } from "~/lib/coins.server";
import { createDb } from "~/lib/db/index";
import type { loader as rootLoader } from "~/root";
import { communities, communitySubscriptions } from "../../db/schema";

export const meta: MetaFunction = () => [
  { title: "Core Coins — Cormunities" },
  {
    name: "description",
    content: "Buy Core Coins to support creators with badges and boost posts.",
  },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);

  const db = createDb(env.DB);
  try {
    const bundles = await getActiveBundles(db);
    const balance = user ? await getBalance(db, user.id) : 0;

    const membershipCommunities = await db
      .select({
        id: communities.id,
        slug: communities.slug,
        name: communities.name,
        membershipPriceCoins: communities.membershipPriceCoins,
        membershipBadgeIcon: communities.membershipBadgeIcon,
        membershipBorderColor: communities.membershipBorderColor,
      })
      .from(communities)
      .where(and(eq(communities.membershipEnabled, true), isNull(communities.deletedAt)));

    const activeSubscriptions = user
      ? await db
          .select({ communityId: communitySubscriptions.communityId })
          .from(communitySubscriptions)
          .where(
            and(
              eq(communitySubscriptions.userId, user.id),
              eq(communitySubscriptions.status, "active"),
            ),
          )
      : [];

    const subscribedIds = new Set(activeSubscriptions.map((s) => s.communityId));

    return {
      user,
      bundles,
      balance,
      dbReady: true,
      membershipCommunities,
      subscribedIds: [...subscribedIds],
    };
  } catch {
    return {
      user,
      bundles: [],
      balance: 0,
      dbReady: false,
      membershipCommunities: [],
      subscribedIds: [],
    };
  }
}

export default function CoinsPage() {
  const { user, bundles, balance, dbReady, membershipCommunities, subscribedIds } =
    useLoaderData<typeof loader>();
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const rootUser = root?.user ?? null;
  const [params] = useSearchParams();
  const paypalStatus = params.get("paypal");

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header user={rootUser} />
      <AppShell>
        <div className="py-6">
          {/* Page title */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold" style={{ color: "var(--color-text)" }}>
              Core Coins
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--color-text-dim)" }}>
              Give badges to posts you love. Support creators directly.
            </p>
          </div>

          {/* Status banners — full width above columns */}
          {!dbReady && (
            <div
              className="rounded-lg px-4 py-3 mb-5 text-sm"
              style={{
                background: "rgba(229,72,77,0.1)",
                border: "1px solid var(--color-danger)",
                color: "var(--color-danger)",
              }}
            >
              The coins database is not yet set up. Run the migration and try again.
            </div>
          )}
          {paypalStatus === "success" && (
            <div
              className="rounded-lg px-4 py-3 mb-5 text-sm font-medium"
              style={{
                background: "rgba(61,214,140,0.1)",
                border: "1px solid var(--color-success)",
                color: "var(--color-success)",
              }}
            >
              Payment confirmed! Coins have been added to your wallet.
            </div>
          )}
          {(paypalStatus === "cancelled" || paypalStatus === "error") && (
            <div
              className="rounded-lg px-4 py-3 mb-5 text-sm"
              style={{
                background: "rgba(229,72,77,0.1)",
                border: "1px solid var(--color-danger)",
                color: "var(--color-danger)",
              }}
            >
              {paypalStatus === "error"
                ? "Payment failed. Contact support if you were charged."
                : "Payment cancelled. No charge was made."}
            </div>
          )}

          {/* Two-column layout */}
          <div className="flex flex-col lg:flex-row gap-6 items-stretch">
            {/* ── Left column ── */}
            <div className="flex-1 min-w-0 flex flex-col gap-5">
              {/* Balance */}
              {user && (
                <div
                  className="rounded-xl p-5 flex items-center justify-between"
                  style={{
                    background: "var(--color-bg-elev-1)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <div>
                    <p
                      className="text-xs uppercase tracking-wide mb-1"
                      style={{ color: "var(--color-text-faint)" }}
                    >
                      Your balance
                    </p>
                    <p className="text-3xl font-bold" style={{ color: "var(--color-text)" }}>
                      {formatCoins(balance)}
                      <span
                        className="text-sm font-normal ml-1"
                        style={{ color: "var(--color-text-faint)" }}
                      >
                        cc
                      </span>
                    </p>
                  </div>
                  <a
                    href="/wallet"
                    className="text-xs px-3 py-1.5 rounded-md transition-opacity hover:opacity-80"
                    style={{
                      background: "var(--color-bg-elev-2)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text-dim)",
                    }}
                  >
                    View history
                  </a>
                </div>
              )}

              {/* How it works */}
              <div
                className="rounded-xl p-5"
                style={{
                  background: "var(--color-bg-elev-1)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text)" }}>
                  How it works
                </h2>
                <div className="flex flex-col gap-4">
                  {[
                    {
                      step: "1",
                      title: "Buy a bundle",
                      text: "Purchase Core Coins using PayPal. Coins land in your wallet instantly.",
                    },
                    {
                      step: "2",
                      title: "Give badges",
                      text: "Visit any post and spend coins to award a badge you think it deserves.",
                    },
                    {
                      step: "3",
                      title: "Support creators",
                      text: "The creator earns a cut of your coins. The post gets a visibility boost.",
                    },
                  ].map(({ step, title, text }) => (
                    <div key={step} className="flex gap-4 items-start">
                      <span
                        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                        style={{
                          background: "var(--color-bg-elev-2)",
                          color: "var(--color-text-dim)",
                          border: "1px solid var(--color-border)",
                        }}
                      >
                        {step}
                      </span>
                      <div>
                        <p
                          className="text-sm font-medium mb-0.5"
                          style={{ color: "var(--color-text)" }}
                        >
                          {title}
                        </p>
                        <p
                          className="text-sm leading-snug"
                          style={{ color: "var(--color-text-dim)" }}
                        >
                          {text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Badge types */}
              <div
                className="rounded-xl p-5"
                style={{
                  background: "var(--color-bg-elev-1)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text)" }}>
                  Badge types
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {BADGE_DISPLAY.map((b) => (
                    <div
                      key={b.name}
                      className="flex flex-col items-center gap-1.5 rounded-lg p-3"
                      style={{ background: "var(--color-bg-elev-2)" }}
                    >
                      <span className="text-2xl">{b.icon}</span>
                      <span
                        className="text-xs font-semibold"
                        style={{ color: "var(--color-text)" }}
                      >
                        {b.name}
                      </span>
                      <span className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                        {b.coins} cc
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Right column — Buy coins + Membership ── */}
            <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 flex flex-col gap-4">
              <div
                className="rounded-xl p-5"
                style={{
                  background: "var(--color-bg-elev-1)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--color-text)" }}>
                  Buy coins
                </h2>
                <p className="text-xs mb-4" style={{ color: "var(--color-text-faint)" }}>
                  Processed securely via PayPal. No account required.
                </p>

                {!user ? (
                  <div
                    className="rounded-lg p-4 text-center"
                    style={{
                      background: "var(--color-bg-elev-2)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <p className="text-sm" style={{ color: "var(--color-text-dim)" }}>
                      <a href="/auth/login" style={{ color: "var(--color-text)" }}>
                        Sign in
                      </a>{" "}
                      to buy Core Coins.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {bundles.map((bundle) => (
                      <BundleCard key={bundle.id} bundle={bundle} />
                    ))}
                    {bundles.length === 0 && (
                      <p
                        className="text-sm text-center py-4"
                        style={{ color: "var(--color-text-faint)" }}
                      >
                        No bundles available right now.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Member Subscription */}
              <MembershipSection
                communities={membershipCommunities}
                subscribedIds={subscribedIds}
                user={user}
              />
            </div>
          </div>
        </div>
      </AppShell>
      <Footer />
    </div>
  );
}

const BADGE_DISPLAY = [
  { name: "Lurker", icon: "👻", coins: 50 },
  { name: "Hype", icon: "🔥", coins: 100 },
  { name: "Clip It", icon: "🎬", coins: 250 },
  { name: "W Post", icon: "🏆", coins: 500 },
  { name: "Goated", icon: "🐐", coins: 1000 },
  { name: "Viral", icon: "💥", coins: 2500 },
  { name: "Legend", icon: "⭐", coins: 5000 },
  { name: "Core", icon: "💎", coins: 10000 },
];

type MembershipCommunity = {
  id: string;
  slug: string;
  name: string;
  membershipPriceCoins: number;
  membershipBadgeIcon: string;
  membershipBorderColor: string;
};

function MembershipSection({
  communities: comms,
  subscribedIds,
  user,
}: {
  communities: MembershipCommunity[];
  subscribedIds: string[];
  user: { id: string } | null;
}) {
  const [selected, setSelected] = useState(comms[0]?.id ?? "");
  const fetcher = useFetcher<{ error?: string; success?: boolean }>({ key: "community-subscribe" });
  const selectedComm = comms.find((c) => c.id === selected);
  const isSubscribed = subscribedIds.includes(selected);
  const isSubmitting = fetcher.state !== "idle";

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "2px solid #F59E0B", minHeight: 260 }}
    >
      {/* Amber header strip */}
      <div
        className="px-5 py-3 flex items-center gap-2"
        style={{ background: "rgba(245,158,11,0.15)" }}
      >
        <span className="text-lg">⭐</span>
        <div>
          <h2 className="text-sm font-bold" style={{ color: "#F59E0B" }}>
            Member Subscription
          </h2>
          <p className="text-xs" style={{ color: "var(--color-text-dim)" }}>
            Support a community with Core Coins — get a badge &amp; exclusive post border
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="p-5" style={{ background: "var(--color-bg-elev-1)" }}>
        {comms.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="text-4xl">🔐</span>
            <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
              No memberships available yet
            </p>
            <p
              className="text-xs max-w-xs leading-relaxed"
              style={{ color: "var(--color-text-faint)" }}
            >
              Streamers can enable memberships in their community settings. Check back once your
              favourite community activates it.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Community picker */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="membership-community"
                className="text-xs font-medium"
                style={{ color: "var(--color-text-dim)" }}
              >
                Choose community
              </label>
              <select
                id="membership-community"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="w-full rounded-md px-3 py-2 text-sm"
                style={{
                  background: "var(--color-bg-elev-2)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                  outline: "none",
                }}
              >
                {comms.map((c) => (
                  <option key={c.id} value={c.id}>
                    c/{c.slug} — {c.membershipPriceCoins} cc/week
                  </option>
                ))}
              </select>
            </div>

            {/* Selected community preview */}
            {selectedComm && (
              <div
                className="rounded-lg p-4 flex items-center gap-3"
                style={{
                  background: "var(--color-bg-elev-2)",
                  borderLeft: `4px solid ${selectedComm.membershipBorderColor}`,
                }}
              >
                <span className="text-2xl">{selectedComm.membershipBadgeIcon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                    c/{selectedComm.slug} Member
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-faint)" }}>
                    {selectedComm.membershipPriceCoins} cc/week · custom badge + post border
                  </p>
                </div>
                {isSubscribed && (
                  <span
                    className="text-xs px-2 py-1 rounded-full font-semibold"
                    style={{ background: "rgba(61,214,140,0.15)", color: "var(--color-success)" }}
                  >
                    Active
                  </span>
                )}
              </div>
            )}

            {fetcher.data?.error && (
              <p className="text-xs" style={{ color: "var(--color-danger)" }}>
                {fetcher.data.error}
              </p>
            )}
            {fetcher.data?.success && (
              <p className="text-xs font-medium" style={{ color: "var(--color-success)" }}>
                Subscribed! Your membership badge is now active.
              </p>
            )}

            {!user ? (
              <p className="text-sm text-center py-2" style={{ color: "var(--color-text-faint)" }}>
                <a href="/auth/login" style={{ color: "#F59E0B" }}>
                  Sign in
                </a>{" "}
                to subscribe.
              </p>
            ) : isSubscribed ? (
              <fetcher.Form method="post" action="/api/community/cancel-subscription">
                <input type="hidden" name="communityId" value={selected} />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="text-xs px-3 py-1.5 rounded-md transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{
                    background: "var(--color-bg-elev-2)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-dim)",
                  }}
                >
                  {isSubmitting ? "…" : "Cancel membership"}
                </button>
              </fetcher.Form>
            ) : (
              <fetcher.Form method="post" action="/api/community/subscribe">
                <input type="hidden" name="communityId" value={selected} />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 text-sm font-bold rounded-md transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: "#F59E0B", color: "#000" }}
                >
                  {isSubmitting
                    ? "Subscribing…"
                    : `Subscribe — ${selectedComm?.membershipPriceCoins ?? 0} cc/week`}
                </button>
              </fetcher.Form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type Bundle = {
  id: string;
  name: string;
  coinAmount: number;
  usdPriceCents: number;
  bonusLabel: string | null;
  isActive: boolean;
  displayOrder: number;
};

function BundleCard({ bundle }: { bundle: Bundle }) {
  const paypalFetcher = useFetcher<{ approvalUrl?: string; error?: string }>({
    key: `paypal-${bundle.id}`,
  });

  const usdDisplay = `$${(bundle.usdPriceCents / 100).toFixed(2)}`;
  const basePriceCents = bundle.coinAmount; // 100 cc = $1 base rate
  const savingCents = basePriceCents - bundle.usdPriceCents;
  const basePriceDisplay = savingCents >= 10 ? `$${(basePriceCents / 100).toFixed(2)}` : null;
  const approvalUrl = paypalFetcher.data?.approvalUrl;
  const isSubmitting = paypalFetcher.state !== "idle";

  useEffect(() => {
    if (approvalUrl) window.location.href = approvalUrl;
  }, [approvalUrl]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    paypalFetcher.submit(e.currentTarget);
  }

  return (
    <div
      className="rounded-lg p-4 flex items-center justify-between gap-3"
      style={{ background: "var(--color-bg-elev-2)", border: "1px solid var(--color-border)" }}
    >
      <div className="min-w-0">
        <p className="text-xs font-medium truncate" style={{ color: "var(--color-text-dim)" }}>
          {bundle.name}
        </p>
        <p className="text-lg font-bold leading-tight" style={{ color: "var(--color-text)" }}>
          {formatCoins(bundle.coinAmount)}
          <span className="text-xs font-normal ml-1" style={{ color: "var(--color-text-faint)" }}>
            cc
          </span>
        </p>
        {bundle.bonusLabel && (
          <p className="text-xs mt-0.5" style={{ color: "var(--color-success)" }}>
            {bundle.bonusLabel}
          </p>
        )}
      </div>

      <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
        {basePriceDisplay && (
          <p className="text-xs line-through" style={{ color: "var(--color-text-faint)" }}>
            {basePriceDisplay}
          </p>
        )}
        <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          {usdDisplay}
        </p>
        {paypalFetcher.data?.error && (
          <p className="text-xs" style={{ color: "var(--color-danger)" }}>
            {paypalFetcher.data.error}
          </p>
        )}
        <form method="post" action="/api/coins/paypal/create" onSubmit={handleSubmit}>
          <input type="hidden" name="bundleId" value={bundle.id} />
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-3 py-1.5 text-xs font-medium rounded-md transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: "#0070BA", color: "#fff" }}
          >
            {isSubmitting ? "…" : "Buy"}
          </button>
        </form>
      </div>
    </div>
  );
}
