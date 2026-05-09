import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import {
  redirect,
  useFetcher,
  useLoaderData,
  useRouteLoaderData,
  useSearchParams,
} from "@remix-run/react";
import { and, eq, isNull } from "drizzle-orm";
import { type FormEvent, useEffect, useState } from "react";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { getCurrentUser } from "~/lib/auth/user.server";
import { formatCoins } from "~/lib/coins";
import { getActiveBundles, getBalance, getTransactionHistory } from "~/lib/coins.server";
import { createDb } from "~/lib/db/index";
import type { loader as rootLoader } from "~/root";
import { communities, communitySubscriptions } from "../../db/schema";

export const meta: MetaFunction = () => [
  { title: "Core Coins — Cormunities" },
  { name: "description", content: "Buy Core Coins and manage your wallet." },
];

const TABS = ["buy", "wallet"] as const;
type Tab = (typeof TABS)[number];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);

  const url = new URL(request.url);
  const tab = (url.searchParams.get("tab") as Tab) ?? "buy";
  const validTab = TABS.includes(tab) ? tab : "buy";

  // Wallet requires auth; buy is public
  if (!user && validTab === "wallet") return redirect("/auth/login?next=/monetization");

  const db = createDb(env.DB);

  try {
    const bundles = await getActiveBundles(db);

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

    if (!user) {
      return {
        user: null,
        tab: "buy" as Tab,
        bundles,
        balance: 0,
        transactions: [],
        membershipCommunities,
        subscribedIds: [] as string[],
        dbReady: true,
      };
    }

    const [balance, transactions, activeSubscriptions] = await Promise.all([
      getBalance(db, user.id),
      getTransactionHistory(db, user.id, 50),
      db
        .select({ communityId: communitySubscriptions.communityId })
        .from(communitySubscriptions)
        .where(
          and(
            eq(communitySubscriptions.userId, user.id),
            eq(communitySubscriptions.status, "active"),
          ),
        ),
    ]);

    return {
      user,
      tab: validTab,
      bundles,
      balance,
      transactions,
      membershipCommunities,
      subscribedIds: activeSubscriptions.map((s) => s.communityId),
      dbReady: true,
    };
  } catch {
    return {
      user,
      tab: validTab,
      bundles: [],
      balance: 0,
      transactions: [],
      membershipCommunities: [],
      subscribedIds: [] as string[],
      dbReady: false,
    };
  }
}

const TX_LABELS: Record<string, string> = {
  purchase: "Bought coins",
  spend: "Badge given",
  refund: "Refund",
  admin_credit: "Admin credit",
  admin_debit: "Admin debit",
  earning: "Creator earning",
};

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

export default function MonetisationPage() {
  const data = useLoaderData<typeof loader>();
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const rootUser = root?.user ?? null;
  const [params, setParams] = useSearchParams();
  const activeTab: Tab = (params.get("tab") as Tab) ?? data.tab ?? "buy";

  function switchTab(tab: Tab) {
    setParams(
      (p) => {
        p.set("tab", tab);
        return p;
      },
      { preventScrollReset: true },
    );
  }

  const paypalStatus = params.get("paypal");

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header user={rootUser} />
      <AppShell>
        <div className="py-6">
          {/* Header row */}
          <div className="mb-5">
            <h1 className="text-2xl font-semibold" style={{ color: "var(--color-text)" }}>
              Core Coins
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--color-text-dim)" }}>
              Buy coins and support creators with badges.
            </p>
          </div>

          {/* DB not ready */}
          {!data.dbReady && (
            <div
              className="rounded-lg px-4 py-3 mb-5 text-sm"
              style={{
                background: "rgba(229,72,77,0.1)",
                border: "1px solid var(--color-danger)",
                color: "var(--color-danger)",
              }}
            >
              Database migration pending. Run migrations and try again.
            </div>
          )}

          {/* PayPal status banners */}
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

          {/* Tab bar */}
          <div
            className="flex gap-1 mb-6 p-1 rounded-lg w-fit"
            style={{
              background: "var(--color-bg-elev-1)",
              border: "1px solid var(--color-border)",
            }}
          >
            {(
              [
                { id: "buy", label: "Buy Coins" },
                { id: "wallet", label: "Wallet" },
              ] as { id: Tab; label: string }[]
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => switchTab(id)}
                className={`px-4 py-1.5 text-sm rounded-md font-medium transition-all${activeTab !== id ? " tab-btn" : ""}`}
                style={{
                  background: activeTab === id ? "var(--color-bg-elev-2)" : "transparent",
                  color: activeTab === id ? "var(--color-text)" : "var(--color-text-faint)",
                  border:
                    activeTab === id ? "1px solid var(--color-border)" : "1px solid transparent",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Wallet tab ── */}
          {activeTab === "wallet" && data.user && (
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              {/* Balance */}
              <div className="flex-shrink-0 w-full lg:w-72">
                <div
                  className="rounded-xl p-6 mb-4"
                  style={{
                    background: "var(--color-bg-elev-1)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <p
                    className="text-xs uppercase tracking-wide mb-1"
                    style={{ color: "var(--color-text-faint)" }}
                  >
                    Current balance
                  </p>
                  <p className="text-4xl font-bold" style={{ color: "var(--color-text)" }}>
                    {formatCoins(data.balance)}
                  </p>
                  <p className="text-sm mt-1" style={{ color: "var(--color-text-faint)" }}>
                    Core Coins
                  </p>
                  <button
                    type="button"
                    onClick={() => switchTab("buy")}
                    className="mt-4 w-full py-2 text-sm font-medium rounded-lg transition-opacity hover:opacity-80"
                    style={{ background: "var(--color-text)", color: "var(--color-bg)" }}
                  >
                    Buy more coins
                  </button>
                </div>

                {/* Quick badge reference */}
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: "var(--color-bg-elev-1)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <p
                    className="text-xs font-semibold mb-3"
                    style={{ color: "var(--color-text-faint)" }}
                  >
                    BADGE COSTS
                  </p>
                  <div className="flex flex-col gap-2">
                    {BADGE_DISPLAY.map((b) => (
                      <div key={b.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{b.icon}</span>
                          <span className="text-xs" style={{ color: "var(--color-text-dim)" }}>
                            {b.name}
                          </span>
                        </div>
                        <span
                          className="text-xs font-medium"
                          style={{ color: "var(--color-text-faint)" }}
                        >
                          {b.coins} cc
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Transaction history */}
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text)" }}>
                  Transaction history
                </h2>
                {data.transactions.length === 0 ? (
                  <div
                    className="rounded-xl p-8 text-center"
                    style={{
                      background: "var(--color-bg-elev-1)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <p className="text-sm mb-2" style={{ color: "var(--color-text-faint)" }}>
                      No transactions yet.
                    </p>
                    <button
                      type="button"
                      onClick={() => switchTab("buy")}
                      className="text-sm"
                      style={{ color: "var(--color-text-dim)" }}
                    >
                      Buy your first coins →
                    </button>
                  </div>
                ) : (
                  <div
                    className="rounded-xl overflow-hidden"
                    style={{
                      background: "var(--color-bg-elev-1)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    {data.transactions
                      .filter((tx): tx is NonNullable<typeof tx> => tx != null)
                      .map((tx, i) => {
                        const isCredit = tx.amount > 0;
                        return (
                          <div
                            key={tx.id}
                            className="flex items-center justify-between px-4 py-3"
                            style={{
                              borderTop: i > 0 ? "1px solid var(--color-border)" : undefined,
                            }}
                          >
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <p
                                className="text-sm font-medium"
                                style={{ color: "var(--color-text)" }}
                              >
                                {TX_LABELS[tx.type] ?? tx.type}
                              </p>
                              {tx.note && (
                                <p
                                  className="text-xs truncate"
                                  style={{ color: "var(--color-text-faint)" }}
                                >
                                  {tx.note}
                                </p>
                              )}
                              <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                                {new Date(tx.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <span
                              className="text-sm font-semibold flex-shrink-0 ml-4"
                              style={{
                                color: isCredit ? "var(--color-success)" : "var(--color-danger)",
                              }}
                            >
                              {isCredit ? "+" : ""}
                              {formatCoins(tx.amount)} cc
                            </span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Buy Coins tab ── */}
          {activeTab === "buy" && (
            <div className="flex flex-col lg:flex-row gap-6 items-stretch">
              {/* Left — info */}
              <div className="flex-1 min-w-0 flex flex-col gap-5">
                {data.user && (
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
                        {formatCoins(data.balance)}
                        <span
                          className="text-sm font-normal ml-1"
                          style={{ color: "var(--color-text-faint)" }}
                        >
                          cc
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => switchTab("wallet")}
                      className="text-xs px-3 py-1.5 rounded-md transition-opacity hover:opacity-80"
                      style={{
                        background: "var(--color-bg-elev-2)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text-dim)",
                      }}
                    >
                      View history
                    </button>
                  </div>
                )}

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
                        text: "Purchase Core Coins via PayPal. They land in your wallet instantly.",
                      },
                      {
                        step: "2",
                        title: "Give badges",
                        text: "Visit any post and spend coins to award a badge you think it deserves.",
                      },
                      {
                        step: "3",
                        title: "Support creators",
                        text: "The creator earns a cut. The post gets a visibility boost.",
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

                <div
                  className="rounded-xl px-4 py-3"
                  style={{
                    background: "var(--color-bg-elev-1)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--color-text)" }}>
                    Badge types
                  </h2>
                  <div className="grid grid-cols-4 gap-1.5">
                    {BADGE_DISPLAY.map((b) => (
                      <div
                        key={b.name}
                        className="flex items-center gap-1.5 rounded-md px-2 py-2"
                        style={{ background: "var(--color-bg-elev-2)" }}
                      >
                        <span className="text-base flex-shrink-0">{b.icon}</span>
                        <div className="min-w-0">
                          <p
                            className="text-xs font-medium truncate"
                            style={{ color: "var(--color-text)" }}
                          >
                            {b.name}
                          </p>
                          <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                            {b.coins} cc
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <MembershipSection
                  communities={(data.membershipCommunities as MembershipCommunity[]).filter(
                    (c) => c !== null,
                  )}
                  subscribedIds={data.subscribedIds}
                  user={data.user}
                />
              </div>

              {/* Right — buy panel */}
              <div className="w-full lg:w-80 xl:w-96 flex-shrink-0">
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
                  {!data.user ? (
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
                      {data.bundles.filter(Boolean).map((bundle) => (
                        // biome-ignore lint/style/noNonNullAssertion: filtered above
                        <BundleCard key={bundle!.id} bundle={bundle as Bundle} />
                      ))}
                      {data.bundles.length === 0 && (
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
              </div>
            </div>
          )}
        </div>
      </AppShell>
      <Footer />
    </div>
  );
}

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
      className="rounded-xl p-5 flex flex-col flex-1"
      style={{ background: "var(--color-bg-elev-1)", border: "1px solid var(--color-border)" }}
    >
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--color-text)" }}>
          Community membership
        </h2>
        <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
          Subscribe to a pioneer community with Core Coins and get a member badge on your posts.
        </p>
      </div>

      {comms.length === 0 ? (
        <div
          className="flex-1 flex items-center justify-center rounded-lg text-center p-6"
          style={{ background: "var(--color-bg-elev-2)", border: "1px solid var(--color-border)" }}
        >
          <p className="text-sm" style={{ color: "var(--color-text-dim)" }}>
            No pioneer communities have enabled membership yet.
          </p>
        </div>
      ) : (
        <>
          {/* Community picker */}
          <div className="flex flex-col gap-1.5 mb-4">
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
              className="w-full rounded-md px-3 py-2.5 text-sm"
              style={{
                background: "var(--color-bg-elev-2)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
                outline: "none",
              }}
            >
              {comms.map((c) => (
                <option key={c.id} value={c.id}>
                  c/{c.slug}
                </option>
              ))}
            </select>
          </div>

          {/* Membership preview */}
          {selectedComm && (
            <div
              className="rounded-lg p-4 mb-4"
              style={{
                background: "var(--color-bg-elev-2)",
                borderLeft: `3px solid ${selectedComm.membershipBorderColor}`,
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xl">{selectedComm.membershipBadgeIcon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                    c/{selectedComm.slug} Member
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-faint)" }}>
                    850 cc/week
                  </p>
                </div>
                {isSubscribed && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                    style={{
                      background: "rgba(61,214,140,0.15)",
                      color: "var(--color-success)",
                    }}
                  >
                    Active
                  </span>
                )}
              </div>
              <div
                className="grid grid-cols-2 gap-2 text-xs pt-3"
                style={{
                  borderTop: "1px solid var(--color-border)",
                  color: "var(--color-text-faint)",
                }}
              >
                <span>Member badge on posts</span>
                <span>Custom post border</span>
                <span>Pioneer community access</span>
                <span>Weekly renewal</span>
              </div>
            </div>
          )}

          {/* Feedback messages */}
          {fetcher.data?.error && (
            <p className="text-xs mb-3" style={{ color: "var(--color-danger)" }}>
              {fetcher.data.error}
            </p>
          )}
          {fetcher.data?.success && (
            <p className="text-xs mb-3" style={{ color: "var(--color-success)" }}>
              Subscribed! Your membership badge is now active.
            </p>
          )}

          {/* Action — pinned to bottom */}
          <div className="mt-auto pt-2">
            {!user ? (
              <p className="text-xs text-center" style={{ color: "var(--color-text-faint)" }}>
                <a href="/auth/login" style={{ color: "var(--color-text)" }}>
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
                  className="w-full py-2.5 text-sm font-medium rounded-md transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: "var(--color-text)", color: "var(--color-bg)" }}
                >
                  {isSubmitting ? "Subscribing…" : "Subscribe — 850 cc/week"}
                </button>
              </fetcher.Form>
            )}
          </div>
        </>
      )}
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
