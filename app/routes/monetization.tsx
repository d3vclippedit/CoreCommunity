import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { redirect, useLoaderData, useRouteLoaderData } from "@remix-run/react";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { checkEligibility, getPayoutHistory } from "~/lib/monetization.server";
import type { loader as rootLoader } from "~/root";

export const meta: MetaFunction = () => [{ title: "Creator Monetization — CORE" }];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) return redirect("/auth/login");

  const db = createDb(env.DB);
  const [eligibility, payoutHistory] = await Promise.all([
    checkEligibility(db, user.id),
    getPayoutHistory(db, user.id),
  ]);

  return { user, eligibility, payoutHistory };
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

export default function MonetizationPage() {
  const { eligibility, payoutHistory } = useLoaderData<typeof loader>();
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const rootUser = root?.user ?? null;

  const PAYOUT_STATUS_LABELS: Record<string, string> = {
    pending: "Pending",
    processing: "Processing",
    completed: "Completed",
    failed: "Failed",
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header user={rootUser} />
      <AppShell>
        <div className="py-6 max-w-2xl">
          <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--color-text)" }}>
            Creator Monetization
          </h1>
          <p className="text-sm mb-6" style={{ color: "var(--color-text-dim)" }}>
            Earn from badges given to your posts. Meet all requirements to unlock payouts.
          </p>

          {/* Eligibility status */}
          <div
            className="rounded-xl p-5 mb-5"
            style={{
              background: "var(--color-bg-elev-1)",
              border: `1px solid ${eligibility.isEligible ? "var(--color-success)" : "var(--color-border)"}`,
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">{eligibility.isEligible ? "✅" : "⏳"}</span>
              <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                {eligibility.isEligible
                  ? "You're eligible for payouts!"
                  : "Requirements to unlock payouts"}
              </h2>
            </div>

            <div className="flex flex-col gap-4">
              <ProgressBar
                value={eligibility.followerCount}
                max={eligibility.followerGoal}
                label="Followers (last 28 days)"
              />
              <ProgressBar
                value={eligibility.postCount}
                max={eligibility.postGoal}
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
                      color: eligibility.badgeValueMet
                        ? "var(--color-success)"
                        : "var(--color-text-dim)",
                    }}
                  >
                    {eligibility.badgeValueMet ? "✓ Met" : "Not yet met"}
                  </span>
                </div>
                <div
                  className="h-1.5 w-full rounded-full overflow-hidden"
                  style={{ background: "var(--color-bg-elev-2)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: eligibility.badgeValueMet ? "100%" : "0%",
                      background: eligibility.badgeValueMet
                        ? "var(--color-success)"
                        : "var(--color-text)",
                    }}
                  />
                </div>
              </div>
            </div>

            {!eligibility.isEligible && (
              <p className="text-xs mt-4" style={{ color: "var(--color-text-faint)" }}>
                All three requirements must be met in the same rolling 28-day window.
              </p>
            )}
          </div>

          {/* How payouts work */}
          <div
            className="rounded-xl p-5 mb-5"
            style={{
              background: "var(--color-bg-elev-1)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text)" }}>
              How payouts work
            </h2>
            <ul className="flex flex-col gap-2">
              {[
                "When viewers give your posts badges, you earn a share of the coins spent.",
                "Once eligible, your pending earnings are processed monthly.",
                "Payouts are sent via the payment method on file with our team.",
                "Contact support at any time to request an early review of your eligibility.",
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

          {/* Payout history */}
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text)" }}>
            Payout history
          </h2>
          {payoutHistory.length === 0 ? (
            <div
              className="rounded-xl p-5 text-center"
              style={{
                background: "var(--color-bg-elev-1)",
                border: "1px solid var(--color-border)",
              }}
            >
              <p className="text-sm" style={{ color: "var(--color-text-faint)" }}>
                No payouts yet.
              </p>
            </div>
          ) : (
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: "var(--color-bg-elev-1)",
                border: "1px solid var(--color-border)",
              }}
            >
              {payoutHistory.map((payout, i) => (
                <div
                  key={payout.id}
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderTop: i > 0 ? "1px solid var(--color-border)" : undefined }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                      {PAYOUT_STATUS_LABELS[payout.status] ?? payout.status}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-text-faint)" }}>
                      {new Date(payout.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <span
                    className="text-sm font-semibold"
                    style={{
                      color:
                        payout.status === "completed"
                          ? "var(--color-success)"
                          : "var(--color-text-dim)",
                    }}
                  >
                    {PAYOUT_STATUS_LABELS[payout.status] ?? payout.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </AppShell>
      <Footer />
    </div>
  );
}
