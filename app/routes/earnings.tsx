import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import {
  Link,
  redirect,
  useLoaderData,
  useRouteLoaderData,
  useSearchParams,
} from "@remix-run/react";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import {
  checkEligibility,
  checkPartnerEligibility,
  getPayoutHistory,
  getPioneerEnrollment,
  getPioneerMetrics,
} from "~/lib/monetization.server";
import type { loader as rootLoader } from "~/root";

export const meta: MetaFunction = () => [
  { title: "Creator Earnings — CORE" },
  { name: "description", content: "Track your creator earnings and manage payouts." },
];

type Tab = "creator" | "partner" | "pioneer";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) return redirect("/auth/login?next=/earnings");

  const db = createDb(env.DB);
  const url = new URL(request.url);
  const tab = (url.searchParams.get("tab") ?? "creator") as Tab;

  try {
    const [payoutHistory, creatorEligibility, partnerEligibility, pioneerEnrollment] =
      await Promise.all([
        getPayoutHistory(db, user.id),
        checkEligibility(db, user.id),
        checkPartnerEligibility(db, user.id),
        getPioneerEnrollment(db, user.id),
      ]);

    const pioneerMetrics = pioneerEnrollment?.isActive
      ? await getPioneerMetrics(db, pioneerEnrollment.communityId)
      : null;

    return {
      user,
      tab,
      payoutHistory,
      creatorEligibility,
      partnerEligibility,
      pioneerEnrollment,
      pioneerMetrics,
      dbReady: true,
    };
  } catch {
    return {
      user,
      tab,
      payoutHistory: [],
      creatorEligibility: null,
      partnerEligibility: null,
      pioneerEnrollment: null,
      pioneerMetrics: null,
      dbReady: false,
    };
  }
}

export default function EarningsPage() {
  const {
    tab,
    payoutHistory,
    creatorEligibility,
    partnerEligibility,
    pioneerEnrollment,
    pioneerMetrics,
    dbReady,
  } = useLoaderData<typeof loader>();
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const rootUser = root?.user ?? null;
  const [, setSearchParams] = useSearchParams();

  const setTab = (t: Tab) => setSearchParams(t === "creator" ? {} : { tab: t }, { replace: true });

  const tabs: { id: Tab; label: string }[] = [
    { id: "creator", label: "Creator" },
    { id: "partner", label: "Partner" },
    { id: "pioneer", label: "Pioneer" },
  ];

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header user={rootUser} />
      <AppShell>
        <div className="py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold" style={{ color: "var(--color-text)" }}>
              Creator Earnings
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--color-text-dim)" }}>
              Track your earnings, eligibility, and payout history.
            </p>
          </div>

          {!dbReady && (
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

          {/* Tab bar */}
          <div
            className="flex items-center gap-1 mb-6 rounded-lg p-1"
            style={{
              background: "var(--color-bg-elev-1)",
              border: "1px solid var(--color-border)",
            }}
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className="flex-1 py-1.5 text-sm font-medium rounded-md transition-colors"
                style={
                  tab === t.id
                    ? { background: "var(--color-bg-elev-2)", color: "var(--color-text)" }
                    : { color: "var(--color-text-faint)" }
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "creator" && creatorEligibility && (
            <CreatorTab eligibility={creatorEligibility} payoutHistory={payoutHistory} />
          )}
          {tab === "partner" && partnerEligibility && (
            <PartnerTab eligibility={partnerEligibility} payoutHistory={payoutHistory} />
          )}
          {tab === "pioneer" && (
            <PioneerTab enrollment={pioneerEnrollment} metrics={pioneerMetrics} />
          )}
        </div>
      </AppShell>
      <Footer />
    </div>
  );
}

// ── Creator Tab ───────────────────────────────────────────────────────────────

function CreatorTab({
  eligibility,
  payoutHistory,
}: {
  eligibility: NonNullable<ReturnType<typeof useLoaderData<typeof loader>>["creatorEligibility"]>;
  payoutHistory: ReturnType<typeof useLoaderData<typeof loader>>["payoutHistory"];
}) {
  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      <div className="flex-1 min-w-0 flex flex-col gap-5">
        <EligibilityCard
          isEligible={eligibility.isEligible}
          title="Cormunities Creator"
          description="Post regularly and earn badges from your community."
          items={[
            {
              label: "Followers",
              value: eligibility.followerCount,
              goal: eligibility.followerGoal,
            },
            {
              label: "Posts in last 28 days",
              value: eligibility.postCount,
              goal: eligibility.postGoal,
            },
            {
              label: "Badge earnings threshold",
              met: eligibility.badgeValueMet,
            },
          ]}
        />
        <HowItWorksCard />
      </div>
      <PayoutSidebar payoutHistory={payoutHistory} isEligible={eligibility.isEligible} />
    </div>
  );
}

// ── Partner Tab ───────────────────────────────────────────────────────────────

function PartnerTab({
  eligibility,
  payoutHistory,
}: {
  eligibility: NonNullable<ReturnType<typeof useLoaderData<typeof loader>>["partnerEligibility"]>;
  payoutHistory: ReturnType<typeof useLoaderData<typeof loader>>["payoutHistory"];
}) {
  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      <div className="flex-1 min-w-0 flex flex-col gap-5">
        <EligibilityCard
          isEligible={eligibility.isEligible}
          title="Cormunities Partner"
          description="For established creators with a growing audience and strong engagement."
          items={[
            {
              label: "Followers",
              value: eligibility.followerCount,
              goal: eligibility.followerGoal,
            },
            {
              label: "Posts in last 28 days",
              value: eligibility.postCount,
              goal: eligibility.postGoal,
            },
            {
              label: "Views across posts (28 days)",
              value: eligibility.totalViewsOnRecentPosts,
              goal: eligibility.viewGoal,
            },
            {
              label: "Badge earnings threshold",
              met: eligibility.badgeValueMet,
            },
          ]}
        />
        <div
          className="rounded-xl p-5"
          style={{
            background: "var(--color-bg-elev-1)",
            border: "1px solid var(--color-border)",
          }}
        >
          <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--color-text)" }}>
            About Cormunities Partner
          </h2>
          <p className="text-sm" style={{ color: "var(--color-text-dim)" }}>
            Partner status recognises your sustained contribution to CORE. Once eligible, contact
            our team to complete enrollment. Partners receive a dedicated account manager.
          </p>
        </div>
      </div>
      <PayoutSidebar payoutHistory={payoutHistory} isEligible={eligibility.isEligible} />
    </div>
  );
}

// ── Pioneer Tab ───────────────────────────────────────────────────────────────

function PioneerTab({
  enrollment,
  metrics,
}: {
  enrollment: ReturnType<typeof useLoaderData<typeof loader>>["pioneerEnrollment"];
  metrics: ReturnType<typeof useLoaderData<typeof loader>>["pioneerMetrics"];
}) {
  if (!enrollment?.isActive) {
    return (
      <div
        className="rounded-xl p-8 text-center"
        style={{
          background: "var(--color-bg-elev-1)",
          border: "1px solid var(--color-border)",
        }}
      >
        <p className="text-base font-semibold mb-2" style={{ color: "var(--color-text)" }}>
          Cormunities Pioneer
        </p>
        <p className="text-sm mb-4" style={{ color: "var(--color-text-dim)" }}>
          Pioneers are the founding creators of CORE — early access, a verified badge, and a share
          of platform ad revenue. Apply and we'll review your application personally.
        </p>
        <Link
          to="/pioneer/apply"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold no-underline transition-opacity hover:opacity-80"
          style={{ background: "var(--color-text)", color: "var(--color-bg)" }}
        >
          Apply now →
        </Link>
      </div>
    );
  }

  const METRIC_LABELS: Record<string, string> = {
    "1d": "Last 24 hours",
    "3d": "Last 3 days",
    "7d": "Last 7 days",
    "28d": "Last 28 days",
  };

  return (
    <div className="flex flex-col gap-6">
      <div
        className="rounded-xl p-5"
        style={{
          background: "var(--color-bg-elev-1)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            Cormunities Pioneer
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: "rgba(61,214,140,0.12)", color: "var(--color-success)" }}
          >
            Active
          </span>
        </div>
        <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
          Enrolled{" "}
          {new Date(enrollment.enrolledAt).toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
          {enrollment.contractRef ? ` · Ref: ${enrollment.contractRef}` : ""}
        </p>
      </div>

      {/* Metrics grid per time window */}
      {metrics && (
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            Community Performance
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {metrics.map((m) => (
              <div
                key={m.window}
                className="rounded-xl p-5"
                style={{
                  background: "var(--color-bg-elev-1)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <p
                  className="text-xs font-semibold uppercase tracking-wide mb-4"
                  style={{ color: "var(--color-text-faint)" }}
                >
                  {METRIC_LABELS[m.window]}
                </p>
                <div className="grid grid-cols-2 gap-y-4">
                  <MetricCell label="CC Spent" value={m.ccSpent.toLocaleString()} />
                  <MetricCell label="New Members" value={m.newMembers.toLocaleString()} />
                  <MetricCell
                    label="Recurring Members"
                    value={m.recurringMembers.toLocaleString()}
                  />
                  <MetricCell label="Posts" value={m.postCount.toLocaleString()} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs mb-0.5" style={{ color: "var(--color-text-faint)" }}>
        {label}
      </p>
      <p className="text-lg font-semibold tabular-nums" style={{ color: "var(--color-text)" }}>
        {value}
      </p>
    </div>
  );
}

// ── Shared components ─────────────────────────────────────────────────────────

type EligibilityItem =
  | { label: string; value: number; goal: number; met?: never }
  | { label: string; met: boolean; value?: never; goal?: never };

function EligibilityCard({
  isEligible,
  title,
  description,
  items,
}: {
  isEligible: boolean;
  title: string;
  description: string;
  items: EligibilityItem[];
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: "var(--color-bg-elev-1)",
        border: `1px solid ${isEligible ? "var(--color-success)" : "var(--color-border)"}`,
      }}
    >
      <div className="flex items-start gap-3 mb-5">
        <span className="text-lg mt-0.5">{isEligible ? "✅" : "⏳"}</span>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {isEligible ? `${title} — Eligible!` : `Requirements for ${title}`}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-faint)" }}>
            {description}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-5">
        {items.map((item) =>
          item.met !== undefined ? (
            <div key={item.label} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "var(--color-text-dim)" }}>
                  {item.label}
                </span>
                <span
                  className="text-xs font-medium"
                  style={{ color: item.met ? "var(--color-success)" : "var(--color-text-dim)" }}
                >
                  {item.met ? "✓ Met" : "Not yet met"}
                </span>
              </div>
              <div
                className="h-1.5 w-full rounded-full overflow-hidden"
                style={{ background: "var(--color-bg-elev-2)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: item.met ? "100%" : "0%",
                    background: item.met ? "var(--color-success)" : "var(--color-text)",
                  }}
                />
              </div>
            </div>
          ) : (
            <ProgressBar key={item.label} value={item.value} max={item.goal} label={item.label} />
          ),
        )}
      </div>
      {!isEligible && (
        <p className="text-xs mt-4" style={{ color: "var(--color-text-faint)" }}>
          All requirements must be met within the same rolling 28-day window.
        </p>
      )}
    </div>
  );
}

function HowItWorksCard() {
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "var(--color-bg-elev-1)", border: "1px solid var(--color-border)" }}
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
  );
}

const PAYOUT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
};

function PayoutSidebar({
  payoutHistory: payoutHistoryRaw,
  isEligible,
}: {
  payoutHistory: ({ id: string; status: string; createdAt: string | Date } | null)[];
  isEligible: boolean;
}) {
  const payoutHistory = payoutHistoryRaw.filter((p): p is NonNullable<typeof p> => p !== null);
  return (
    <div className="w-full lg:w-80 xl:w-96 flex-shrink-0">
      <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text)" }}>
        Payout history
      </h2>
      {payoutHistory.length === 0 ? (
        <div
          className="rounded-xl p-6 text-center"
          style={{ background: "var(--color-bg-elev-1)", border: "1px solid var(--color-border)" }}
        >
          <p className="text-sm" style={{ color: "var(--color-text-faint)" }}>
            No payouts yet.
          </p>
          {!isEligible && (
            <p className="text-xs mt-2" style={{ color: "var(--color-text-faint)" }}>
              Complete the requirements to unlock payouts.
            </p>
          )}
        </div>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: "var(--color-bg-elev-1)", border: "1px solid var(--color-border)" }}
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
          {done ? "✓ Done" : `${value.toLocaleString()} / ${max.toLocaleString()}`}
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
