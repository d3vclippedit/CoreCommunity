import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import {
  redirect,
  useFetcher,
  useLoaderData,
  useRouteLoaderData,
  useSearchParams,
} from "@remix-run/react";
import { type FormEvent, useEffect } from "react";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { getCurrentUser } from "~/lib/auth/user.server";
import { formatCoins } from "~/lib/coins";
import { getActiveBundles, getBalance, getTransactionHistory } from "~/lib/coins.server";
import { createDb } from "~/lib/db/index";
import { checkEligibility, getPayoutHistory } from "~/lib/monetization.server";
import type { loader as rootLoader } from "~/root";

export const meta: MetaFunction = () => [
  { title: "Monetisation — Cormunities" },
  { name: "description", content: "Manage your coins, buy bundles, and track creator earnings." },
];

const TABS = ["wallet", "buy", "earn"] as const;
type Tab = (typeof TABS)[number];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);

  const url = new URL(request.url);
  const tab = (url.searchParams.get("tab") as Tab) ?? "wallet";
  const validTab = TABS.includes(tab) ? tab : "wallet";

  // Wallet and earnings tabs require auth
  if (!user && validTab !== "buy")
    return redirect(`/auth/login?next=/monetization?tab=${validTab}`);

  const db = createDb(env.DB);

  try {
    const bundles = await getActiveBundles(db);

    if (!user) {
      return {
        user: null,
        tab: "buy" as Tab,
        bundles,
        balance: 0,
        transactions: [],
        eligibility: null,
        payoutHistory: [],
        dbReady: true,
      };
    }

    const [balance, transactions, eligibility, payoutHistory] = await Promise.all([
      getBalance(db, user.id),
      getTransactionHistory(db, user.id, 50),
      checkEligibility(db, user.id),
      getPayoutHistory(db, user.id),
    ]);

    return {
      user,
      tab: validTab,
      bundles,
      balance,
      transactions,
      eligibility,
      payoutHistory,
      dbReady: true,
    };
  } catch {
    return {
      user,
      tab: validTab,
      bundles: [],
      balance: 0,
      transactions: [],
      eligibility: null,
      payoutHistory: [],
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

const PAYOUT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
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
  const activeTab: Tab = (params.get("tab") as Tab) ?? data.tab ?? "wallet";

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
              Monetisation
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--color-text-dim)" }}>
              Coins, badges, and creator earnings — all in one place.
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
                { id: "wallet", label: "Wallet" },
                { id: "buy", label: "Buy Coins" },
                { id: "earn", label: "Creator Earnings" },
              ] as { id: Tab; label: string }[]
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => switchTab(id)}
                className="px-4 py-1.5 text-sm rounded-md font-medium transition-all"
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
                          style={{ borderTop: i > 0 ? "1px solid var(--color-border)" : undefined }}
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
            <div className="flex flex-col lg:flex-row gap-6 items-start">
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

          {/* ── Creator Earnings tab ── */}
          {activeTab === "earn" && data.user && data.eligibility && (
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              {/* Left — eligibility */}
              <div className="flex-1 min-w-0 flex flex-col gap-5">
                <div
                  className="rounded-xl p-5"
                  style={{
                    background: "var(--color-bg-elev-1)",
                    border: `1px solid ${data.eligibility.isEligible ? "var(--color-success)" : "var(--color-border)"}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-5">
                    <span className="text-lg">{data.eligibility.isEligible ? "✅" : "⏳"}</span>
                    <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                      {data.eligibility.isEligible
                        ? "You're eligible for payouts!"
                        : "Requirements to unlock payouts"}
                    </h2>
                  </div>

                  <div className="flex flex-col gap-5">
                    <ProgressBar
                      value={data.eligibility.followerCount}
                      max={data.eligibility.followerGoal}
                      label="Followers (last 28 days)"
                    />
                    <ProgressBar
                      value={data.eligibility.postCount}
                      max={data.eligibility.postGoal}
                      label="Posts (last 28 days)"
                    />
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs" style={{ color: "var(--color-text-dim)" }}>
                          Badge earnings threshold
                        </span>
                        <span
                          className="text-xs font-medium"
                          style={{
                            color: data.eligibility.badgeValueMet
                              ? "var(--color-success)"
                              : "var(--color-text-dim)",
                          }}
                        >
                          {data.eligibility.badgeValueMet ? "✓ Met" : "Not yet met"}
                        </span>
                      </div>
                      <div
                        className="h-1.5 w-full rounded-full overflow-hidden"
                        style={{ background: "var(--color-bg-elev-2)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: data.eligibility.badgeValueMet ? "100%" : "0%",
                            background: data.eligibility.badgeValueMet
                              ? "var(--color-success)"
                              : "var(--color-text)",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {!data.eligibility.isEligible && (
                    <p className="text-xs mt-4" style={{ color: "var(--color-text-faint)" }}>
                      All three requirements must be met within the same rolling 28-day window.
                    </p>
                  )}
                </div>

                {/* How payouts work */}
                <div
                  className="rounded-xl p-5"
                  style={{
                    background: "var(--color-bg-elev-1)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text)" }}>
                    How payouts work
                  </h2>
                  <ul className="flex flex-col gap-3">
                    {[
                      "When viewers badge your posts, you earn a share of the coins spent.",
                      "Once eligible, your pending earnings are processed monthly.",
                      "Payouts are sent via the payment method on file with our team.",
                      "Contact support at any time to request an early eligibility review.",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span style={{ color: "var(--color-text-faint)", flexShrink: 0 }}>·</span>
                        <span className="text-sm" style={{ color: "var(--color-text-dim)" }}>
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Right — payout history */}
              <div className="w-full lg:w-80 xl:w-96 flex-shrink-0">
                <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text)" }}>
                  Payout history
                </h2>
                {data.payoutHistory.length === 0 ? (
                  <div
                    className="rounded-xl p-6 text-center"
                    style={{
                      background: "var(--color-bg-elev-1)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <p className="text-sm" style={{ color: "var(--color-text-faint)" }}>
                      No payouts yet.
                    </p>
                    {!data.eligibility.isEligible && (
                      <p className="text-xs mt-2" style={{ color: "var(--color-text-faint)" }}>
                        Complete the requirements above to unlock payouts.
                      </p>
                    )}
                  </div>
                ) : (
                  <div
                    className="rounded-xl overflow-hidden"
                    style={{
                      background: "var(--color-bg-elev-1)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    {data.payoutHistory.map((payout, i) => (
                      <div
                        key={payout.id}
                        className="flex items-center justify-between px-4 py-3"
                        style={{ borderTop: i > 0 ? "1px solid var(--color-border)" : undefined }}
                      >
                        <div>
                          <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                            {PAYOUT_STATUS_LABELS[payout.status] ?? payout.status}
                          </p>
                          <p
                            className="text-xs mt-0.5"
                            style={{ color: "var(--color-text-faint)" }}
                          >
                            {new Date(payout.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <span
                          className="text-xs font-medium px-2 py-1 rounded-md"
                          style={{
                            background:
                              payout.status === "completed"
                                ? "rgba(61,214,140,0.1)"
                                : "var(--color-bg-elev-2)",
                            color:
                              payout.status === "completed"
                                ? "var(--color-success)"
                                : "var(--color-text-faint)",
                          }}
                        >
                          {PAYOUT_STATUS_LABELS[payout.status] ?? payout.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </AppShell>
      <Footer />
    </div>
  );
}

function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const done = value >= max;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "var(--color-text-dim)" }}>
          {label}
        </span>
        <span
          className="text-xs font-medium"
          style={{ color: done ? "var(--color-success)" : "var(--color-text-dim)" }}
        >
          {done ? "✓ Done" : `${value} / ${max}`}
        </span>
      </div>
      <div
        className="h-1.5 w-full rounded-full overflow-hidden"
        style={{ background: "var(--color-bg-elev-2)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: done ? "var(--color-success)" : "var(--color-text)",
          }}
        />
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
