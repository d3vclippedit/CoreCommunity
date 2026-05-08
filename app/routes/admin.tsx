import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
  SerializeFrom,
} from "@remix-run/cloudflare";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "@remix-run/react";
import { desc, eq } from "drizzle-orm";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { getCurrentUser } from "~/lib/auth/user.server";
import { creditCoins, debitCoins } from "~/lib/coins.server";
import { createDb } from "~/lib/db/index";
import {
  banAppeals,
  bans,
  coinBundles,
  communities,
  feedback,
  pioneerEnrollments,
  postBadgeDefinitions,
  users,
} from "../../db/schema";

export const meta: MetaFunction = () => [{ title: "Admin — Cormunities" }];

function isAdmin(user: { isPlatformAdmin: boolean; handle: string }) {
  return user.isPlatformAdmin || user.handle === "d3v";
}

type Tab = "users" | "communities" | "feedback" | "appeals" | "pioneer" | "config";
const TABS: { id: Tab; label: string }[] = [
  { id: "users", label: "Users" },
  { id: "communities", label: "Communities" },
  { id: "feedback", label: "Feedback" },
  { id: "appeals", label: "Appeals" },
  { id: "pioneer", label: "Pioneer" },
  { id: "config", label: "Config" },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user || !isAdmin(user)) throw new Response("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const tab = (url.searchParams.get("tab") as Tab | null) ?? "users";
  const db = createDb(env.DB);

  const [bundles, badgeDefs, feedbackItems, pendingAppeals, pioneerList] = await Promise.all([
    tab === "config" ? db.select().from(coinBundles).orderBy(coinBundles.usdPriceCents) : [],
    tab === "config"
      ? db.select().from(postBadgeDefinitions).orderBy(postBadgeDefinitions.displayOrder)
      : [],
    tab === "feedback"
      ? db
          .select({
            id: feedback.id,
            category: feedback.category,
            message: feedback.message,
            status: feedback.status,
            adminNote: feedback.adminNote,
            createdAt: feedback.createdAt,
            userHandle: users.handle,
          })
          .from(feedback)
          .leftJoin(users, eq(feedback.userId, users.id))
          .orderBy(desc(feedback.createdAt))
          .limit(50)
      : [],
    tab === "appeals"
      ? db
          .select({
            id: banAppeals.id,
            banId: banAppeals.banId,
            message: banAppeals.message,
            status: banAppeals.status,
            createdAt: banAppeals.createdAt,
            userHandle: users.handle,
            communitySlug: communities.slug,
            communityName: communities.name,
          })
          .from(banAppeals)
          .innerJoin(users, eq(banAppeals.userId, users.id))
          .innerJoin(communities, eq(banAppeals.communityId, communities.id))
          .where(eq(banAppeals.status, "pending"))
          .orderBy(desc(banAppeals.createdAt))
          .limit(50)
      : [],
    tab === "pioneer"
      ? db
          .select({
            id: pioneerEnrollments.id,
            contractRef: pioneerEnrollments.contractRef,
            enrolledAt: pioneerEnrollments.enrolledAt,
            expiresAt: pioneerEnrollments.expiresAt,
            isActive: pioneerEnrollments.isActive,
            userHandle: users.handle,
            communitySlug: communities.slug,
            communityName: communities.name,
          })
          .from(pioneerEnrollments)
          .innerJoin(users, eq(pioneerEnrollments.userId, users.id))
          .innerJoin(communities, eq(pioneerEnrollments.communityId, communities.id))
          .orderBy(desc(pioneerEnrollments.enrolledAt))
          .limit(100)
      : [],
  ]);

  return { user, tab, bundles, badgeDefs, feedbackItems, pendingAppeals, pioneerList };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const currentUser = await getCurrentUser(request, env);
  if (!currentUser || !isAdmin(currentUser)) throw new Response("Forbidden", { status: 403 });

  const form = await request.formData();
  const intent = (form.get("intent") as string | null) ?? "";
  const db = createDb(env.DB);

  if (intent === "verify" || intent === "unverify") {
    const handle = (form.get("handle") as string | null)?.trim().toLowerCase() ?? "";
    if (!handle) return { error: "Handle is required." };
    const target = await db.query.users.findFirst({
      where: eq(users.handle, handle),
      columns: { id: true, handle: true },
    });
    if (!target) return { error: `No user found with handle @${handle}.` };
    await db
      .update(users)
      .set({ isVerifiedStreamer: intent === "verify" })
      .where(eq(users.id, target.id));
    return {
      ok: true,
      msg: `@${target.handle} is now ${intent === "verify" ? "verified ✓" : "unverified"}.`,
    };
  }

  if (intent === "platform_ban" || intent === "platform_unban") {
    const handle = (form.get("banHandle") as string | null)?.trim().toLowerCase() ?? "";
    if (!handle) return { error: "Handle is required." };
    if (handle === "d3v") return { error: "Cannot ban the d3v account." };
    const target = await db.query.users.findFirst({
      where: eq(users.handle, handle),
      columns: { id: true, handle: true },
    });
    if (!target) return { error: `No user found with handle @${handle}.` };
    const banning = intent === "platform_ban";
    await db.update(users).set({ isBanned: banning }).where(eq(users.id, target.id));
    return {
      ok: true,
      msg: `@${target.handle} has been ${banning ? "platform-banned" : "unbanned"}.`,
    };
  }

  if (intent === "coin_credit" || intent === "coin_debit") {
    const handle = (form.get("coinHandle") as string | null)?.trim().toLowerCase() ?? "";
    const amount = Number(form.get("coinAmount") ?? 0);
    const note = (form.get("coinNote") as string | null)?.trim() ?? "";
    if (!handle || !amount || amount <= 0)
      return { error: "Handle and positive amount are required." };
    const target = await db.query.users.findFirst({
      where: eq(users.handle, handle),
      columns: { id: true, handle: true },
    });
    if (!target) return { error: `No user found with handle @${handle}.` };
    try {
      if (intent === "coin_credit") {
        await creditCoins(
          db,
          target.id,
          amount,
          "admin_credit",
          "admin",
          currentUser.id,
          note || `Admin credit by ${currentUser.handle}`,
        );
      } else {
        await debitCoins(
          db,
          target.id,
          amount,
          "admin_debit",
          "admin",
          currentUser.id,
          note || `Admin debit by ${currentUser.handle}`,
        );
      }
      return {
        ok: true,
        msg: `${intent === "coin_credit" ? "Credited" : "Debited"} ${amount} CC ${intent === "coin_credit" ? "to" : "from"} @${target.handle}.`,
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Failed." };
    }
  }

  if (intent === "remove_community" || intent === "restore_community") {
    const slug = (form.get("communitySlug") as string | null)?.trim().toLowerCase() ?? "";
    if (!slug) return { error: "Community slug is required." };
    const community = await db.query.communities.findFirst({
      where: eq(communities.slug, slug),
      columns: { id: true, slug: true, name: true },
    });
    if (!community) return { error: `No community found with slug "${slug}".` };
    const removing = intent === "remove_community";
    await db
      .update(communities)
      .set({ deletedAt: removing ? new Date() : null })
      .where(eq(communities.id, community.id));
    return {
      ok: true,
      msg: `Community "${community.name}" has been ${removing ? "removed" : "restored"}.`,
    };
  }

  if (intent === "feedback_status") {
    const feedbackId = form.get("feedbackId") as string | null;
    const status = form.get("feedbackStatus") as string | null;
    const adminNote = (form.get("adminNote") as string | null)?.trim() ?? "";
    if (!feedbackId || !status) return { error: "Missing feedbackId or status." };
    if (!["open", "read", "resolved"].includes(status)) return { error: "Invalid status." };
    await db
      .update(feedback)
      .set({
        status: status as "open" | "read" | "resolved",
        adminNote: adminNote || null,
        updatedAt: new Date(),
      })
      .where(eq(feedback.id, feedbackId));
    return { ok: true, msg: "Feedback updated." };
  }

  if (intent === "appeal_approve" || intent === "appeal_deny") {
    const appealId = form.get("appealId") as string | null;
    const reviewNote = (form.get("reviewNote") as string | null)?.trim() ?? "";
    if (!appealId) return { error: "Missing appeal ID." };
    const appeal = await db.query.banAppeals.findFirst({
      where: eq(banAppeals.id, appealId),
      columns: { id: true, banId: true },
    });
    if (!appeal) return { error: "Appeal not found." };
    const approving = intent === "appeal_approve";
    await db
      .update(banAppeals)
      .set({
        status: approving ? "approved" : "denied",
        reviewedByUserId: currentUser.id,
        reviewNote: reviewNote || null,
        updatedAt: new Date(),
      })
      .where(eq(banAppeals.id, appealId));
    if (approving) {
      await db.delete(bans).where(eq(bans.id, appeal.banId));
    }
    return { ok: true, msg: `Appeal ${approving ? "approved — ban lifted" : "denied"}.` };
  }

  if (intent === "pioneer_enroll") {
    const handle = (form.get("pioneerHandle") as string | null)?.trim().toLowerCase() ?? "";
    const communitySlug =
      (form.get("pioneerCommunitySlug") as string | null)?.trim().toLowerCase() ?? "";
    const contractRef = (form.get("pioneerContractRef") as string | null)?.trim() || null;
    if (!handle || !communitySlug) return { error: "Handle and community slug are required." };
    const [target, community] = await Promise.all([
      db.query.users.findFirst({
        where: eq(users.handle, handle),
        columns: { id: true, handle: true },
      }),
      db.query.communities.findFirst({
        where: eq(communities.slug, communitySlug),
        columns: { id: true, slug: true, name: true },
      }),
    ]);
    if (!target) return { error: `No user found with handle @${handle}.` };
    if (!community) return { error: `No community found with slug "${communitySlug}".` };
    await db.insert(pioneerEnrollments).values({
      id: crypto.randomUUID(),
      userId: target.id,
      communityId: community.id,
      enrolledByAdminId: currentUser.id,
      contractRef,
      enrolledAt: new Date(),
      expiresAt: null,
      isActive: true,
    });
    await db.update(users).set({ earningTier: "pioneer" }).where(eq(users.id, target.id));
    return { ok: true, msg: `@${target.handle} enrolled as Pioneer for ${community.name}.` };
  }

  if (intent === "pioneer_revoke") {
    const enrollmentId = form.get("enrollmentId") as string | null;
    if (!enrollmentId) return { error: "Missing enrollment ID." };
    await db
      .update(pioneerEnrollments)
      .set({ isActive: false })
      .where(eq(pioneerEnrollments.id, enrollmentId));
    return { ok: true, msg: "Pioneer enrollment revoked." };
  }

  if (intent === "bundle_toggle") {
    const bundleId = form.get("bundleId") as string | null;
    if (!bundleId) return { error: "Missing bundleId." };
    const bundle = await db
      .select({ isActive: coinBundles.isActive })
      .from(coinBundles)
      .where(eq(coinBundles.id, bundleId))
      .get();
    if (!bundle) return { error: "Bundle not found." };
    await db
      .update(coinBundles)
      .set({ isActive: !bundle.isActive })
      .where(eq(coinBundles.id, bundleId));
    return { ok: true, msg: `Bundle ${bundle.isActive ? "deactivated" : "activated"}.` };
  }

  if (intent === "badge_toggle") {
    const badgeId = form.get("badgeId") as string | null;
    if (!badgeId) return { error: "Missing badgeId." };
    const badge = await db
      .select({ isActive: postBadgeDefinitions.isActive })
      .from(postBadgeDefinitions)
      .where(eq(postBadgeDefinitions.id, badgeId))
      .get();
    if (!badge) return { error: "Badge not found." };
    await db
      .update(postBadgeDefinitions)
      .set({ isActive: !badge.isActive })
      .where(eq(postBadgeDefinitions.id, badgeId));
    return { ok: true, msg: `Badge ${badge.isActive ? "deactivated" : "activated"}.` };
  }

  return { error: "Unknown action." };
}

// ── UI ────────────────────────────────────────────────────────────────────────

const inputCls = "w-full rounded-md px-3 py-2 text-sm outline-none";
const inputStyle = {
  background: "var(--color-bg-elev-2)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
} as const;
const cardStyle = {
  background: "var(--color-bg-elev-1)",
  border: "1px solid var(--color-border)",
} as const;

function Btn({
  value,
  color = "dim",
  disabled,
}: { value: string; color?: "green" | "red" | "dim"; disabled?: boolean }) {
  const bg =
    color === "green"
      ? "var(--color-success)"
      : color === "red"
        ? "var(--color-danger)"
        : "var(--color-bg-elev-2)";
  const fg = color === "green" ? "#000" : color === "red" ? "#fff" : "var(--color-text-dim)";
  return (
    <button
      type="submit"
      name="intent"
      value={value}
      disabled={disabled}
      className="px-4 py-1.5 text-sm font-medium rounded-md disabled:opacity-60"
      style={{
        background: bg,
        color: fg,
        border: color === "dim" ? "1px solid var(--color-border)" : undefined,
      }}
    >
      {disabled ? "…" : value.replace(/_/g, " ")}
    </button>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg p-5 mt-6" style={cardStyle}>
      <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text)" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function StatusMsg({ data }: { data: { ok?: boolean; msg?: string; error?: string } | undefined }) {
  if (!data) return null;
  if ("error" in data)
    return (
      <p className="text-sm mb-3" style={{ color: "var(--color-danger)" }}>
        {data.error}
      </p>
    );
  if ("ok" in data)
    return (
      <p className="text-sm mb-3" style={{ color: "var(--color-success)" }}>
        {data.msg}
      </p>
    );
  return null;
}

type LoaderData = SerializeFrom<typeof loader>;

function UsersTab({ submitting }: { submitting: boolean }) {
  const ad = useActionData<typeof action>();
  return (
    <>
      <Card title="Verified Streamer Badge">
        <StatusMsg data={ad as Parameters<typeof StatusMsg>[0]["data"]} />
        <Form method="post" className="flex flex-col gap-3">
          <input
            name="handle"
            type="text"
            placeholder="Handle (without @)"
            required
            autoComplete="off"
            className={inputCls}
            style={inputStyle}
          />
          <div className="flex gap-2">
            <Btn value="verify" color="green" disabled={submitting} />
            <Btn value="unverify" color="dim" disabled={submitting} />
          </div>
        </Form>
      </Card>

      <Card title="Platform Ban / Unban">
        <Form method="post" className="flex flex-col gap-3">
          <input
            name="banHandle"
            type="text"
            placeholder="Handle (without @)"
            required
            autoComplete="off"
            className={inputCls}
            style={inputStyle}
          />
          <div className="flex gap-2">
            <Btn value="platform_ban" color="red" disabled={submitting} />
            <Btn value="platform_unban" color="green" disabled={submitting} />
          </div>
        </Form>
      </Card>

      <Card title="Adjust Coins">
        <Form method="post" className="flex flex-col gap-3">
          <input
            name="coinHandle"
            type="text"
            placeholder="Handle (without @)"
            required
            autoComplete="off"
            className={inputCls}
            style={inputStyle}
          />
          <input
            name="coinAmount"
            type="number"
            placeholder="Amount (CC)"
            min={1}
            required
            className={inputCls}
            style={inputStyle}
          />
          <input
            name="coinNote"
            type="text"
            placeholder="Note (optional)"
            className={inputCls}
            style={inputStyle}
          />
          <div className="flex gap-2">
            <Btn value="coin_credit" color="green" disabled={submitting} />
            <Btn value="coin_debit" color="red" disabled={submitting} />
          </div>
        </Form>
      </Card>
    </>
  );
}

function CommunitiesTab({ submitting }: { submitting: boolean }) {
  const ad = useActionData<typeof action>();
  return (
    <Card title="Remove / Restore Community">
      <StatusMsg data={ad as Parameters<typeof StatusMsg>[0]["data"]} />
      <Form method="post" className="flex flex-col gap-3">
        <input
          name="communitySlug"
          type="text"
          placeholder="Community slug"
          required
          autoComplete="off"
          className={inputCls}
          style={inputStyle}
        />
        <div className="flex gap-2">
          <Btn value="remove_community" color="red" disabled={submitting} />
          <Btn value="restore_community" color="green" disabled={submitting} />
        </div>
      </Form>
    </Card>
  );
}

function FeedbackTab({ data, submitting }: { data: LoaderData; submitting: boolean }) {
  const ad = useActionData<typeof action>();
  const items = data.feedbackItems;
  return (
    <Card title={`Feedback (${items.length})`}>
      <StatusMsg data={ad as Parameters<typeof StatusMsg>[0]["data"]} />
      {items.length === 0 && (
        <p className="text-sm" style={{ color: "var(--color-text-faint)" }}>
          No feedback submitted yet.
        </p>
      )}
      <div className="flex flex-col gap-4">
        {items.map((f) => {
          if (!f) return null;
          return (
            <div
              key={f.id}
              className="rounded-md p-3"
              style={{
                background: "var(--color-bg-elev-2)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium" style={{ color: "var(--color-text)" }}>
                  {f.userHandle ? `@${f.userHandle}` : "Anonymous"}
                </span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{ background: "var(--color-bg-elev-1)", color: "var(--color-text-dim)" }}
                >
                  {f.category}
                </span>
                <span
                  className="text-xs"
                  style={{
                    color:
                      f.status === "open"
                        ? "var(--color-danger)"
                        : f.status === "read"
                          ? "var(--color-text-dim)"
                          : "var(--color-success)",
                  }}
                >
                  {f.status}
                </span>
              </div>
              <p className="text-sm mb-2" style={{ color: "var(--color-text-dim)" }}>
                {f.message}
              </p>
              {f.adminNote && (
                <p className="text-xs mb-2" style={{ color: "var(--color-text-faint)" }}>
                  Note: {f.adminNote}
                </p>
              )}
              <Form method="post" className="flex gap-2 items-center flex-wrap">
                <input type="hidden" name="feedbackId" value={f.id} />
                <input
                  name="adminNote"
                  type="text"
                  placeholder="Admin note (optional)"
                  defaultValue={f.adminNote ?? ""}
                  className="rounded-md px-2 py-1 text-xs"
                  style={{ ...inputStyle, width: "200px" }}
                />
                <select
                  name="feedbackStatus"
                  defaultValue={f.status}
                  className="rounded-md px-2 py-1 text-xs"
                  style={{ ...inputStyle, width: "100px" }}
                >
                  <option value="open">open</option>
                  <option value="read">read</option>
                  <option value="resolved">resolved</option>
                </select>
                <Btn value="feedback_status" color="dim" disabled={submitting} />
              </Form>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function AppealsTab({ data, submitting }: { data: LoaderData; submitting: boolean }) {
  const ad = useActionData<typeof action>();
  const appeals = data.pendingAppeals;
  return (
    <Card title={`Pending Appeals (${appeals.length})`}>
      <StatusMsg data={ad as Parameters<typeof StatusMsg>[0]["data"]} />
      {appeals.length === 0 && (
        <p className="text-sm" style={{ color: "var(--color-text-faint)" }}>
          No pending appeals.
        </p>
      )}
      <div className="flex flex-col gap-4">
        {appeals.map((a) => {
          if (!a) return null;
          return (
            <div
              key={a.id}
              className="rounded-md p-3"
              style={{
                background: "var(--color-bg-elev-2)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium" style={{ color: "var(--color-text)" }}>
                  @{a.userHandle}
                </span>
                <span className="text-xs" style={{ color: "var(--color-text-dim)" }}>
                  banned from
                </span>
                <Link
                  to={`/c/${a.communitySlug}`}
                  className="text-xs no-underline hover:underline"
                  style={{ color: "var(--color-accent, var(--color-text))" }}
                >
                  {a.communityName}
                </Link>
              </div>
              <p className="text-sm mb-2" style={{ color: "var(--color-text-dim)" }}>
                {a.message}
              </p>
              <Form method="post" className="flex gap-2 items-center flex-wrap">
                <input type="hidden" name="appealId" value={a.id} />
                <input
                  name="reviewNote"
                  type="text"
                  placeholder="Review note (optional)"
                  className="rounded-md px-2 py-1 text-xs"
                  style={{ ...inputStyle, width: "200px" }}
                />
                <Btn value="appeal_approve" color="green" disabled={submitting} />
                <Btn value="appeal_deny" color="red" disabled={submitting} />
              </Form>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function PioneerTab({ data, submitting }: { data: LoaderData; submitting: boolean }) {
  const ad = useActionData<typeof action>();
  const list = data.pioneerList;
  return (
    <>
      <Card title="Enroll Pioneer">
        <StatusMsg data={ad as Parameters<typeof StatusMsg>[0]["data"]} />
        <Form method="post" className="flex flex-col gap-3">
          <input
            name="pioneerHandle"
            type="text"
            placeholder="User handle (without @)"
            required
            autoComplete="off"
            className={inputCls}
            style={inputStyle}
          />
          <input
            name="pioneerCommunitySlug"
            type="text"
            placeholder="Community slug"
            required
            autoComplete="off"
            className={inputCls}
            style={inputStyle}
          />
          <input
            name="pioneerContractRef"
            type="text"
            placeholder="Contract reference (optional)"
            className={inputCls}
            style={inputStyle}
          />
          <Btn value="pioneer_enroll" color="green" disabled={submitting} />
        </Form>
      </Card>

      <Card title={`Current Enrollments (${list.length})`}>
        {list.length === 0 && (
          <p className="text-sm" style={{ color: "var(--color-text-faint)" }}>
            No pioneer enrollments yet.
          </p>
        )}
        <div className="flex flex-col gap-3">
          {list.map((e) => {
            if (!e) return null;
            return (
              <div
                key={e.id}
                className="flex items-center justify-between rounded-md px-3 py-2"
                style={{
                  background: "var(--color-bg-elev-2)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div>
                  <span className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                    @{e.userHandle}
                  </span>
                  <span className="text-xs ml-2" style={{ color: "var(--color-text-dim)" }}>
                    → {e.communityName}
                  </span>
                  {e.contractRef && (
                    <span className="text-xs ml-2" style={{ color: "var(--color-text-faint)" }}>
                      [{e.contractRef}]
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{
                      background: e.isActive ? "var(--color-success)" : "var(--color-bg-elev-1)",
                      color: e.isActive ? "#000" : "var(--color-text-faint)",
                    }}
                  >
                    {e.isActive ? "active" : "revoked"}
                  </span>
                  {e.isActive && (
                    <Form method="post">
                      <input type="hidden" name="enrollmentId" value={e.id} />
                      <Btn value="pioneer_revoke" color="red" disabled={submitting} />
                    </Form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}

function ConfigTab({ data }: { data: LoaderData }) {
  const ad = useActionData<typeof action>();
  return (
    <>
      <Card title="Coin Bundles">
        <StatusMsg data={ad as Parameters<typeof StatusMsg>[0]["data"]} />
        <div className="flex flex-col gap-2">
          {data.bundles.map((b) => {
            if (!b) return null;
            return (
              <div key={b.id} className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--color-text-dim)" }}>
                  {b.name} — {b.coinAmount} CC — ${(b.usdPriceCents / 100).toFixed(2)}
                </span>
                <Form method="post">
                  <input type="hidden" name="bundleId" value={b.id} />
                  <button
                    type="submit"
                    name="intent"
                    value="bundle_toggle"
                    className="text-xs px-3 py-1 rounded-md"
                    style={{
                      background: "var(--color-bg-elev-2)",
                      border: "1px solid var(--color-border)",
                      color: b.isActive ? "var(--color-success)" : "var(--color-text-faint)",
                    }}
                  >
                    {b.isActive ? "Active" : "Inactive"}
                  </button>
                </Form>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Badge Definitions">
        <div className="flex flex-col gap-2">
          {data.badgeDefs.map((b) => {
            if (!b) return null;
            return (
              <div key={b.id} className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--color-text-dim)" }}>
                  {b.icon} {b.name} — {b.coinCost} CC
                </span>
                <Form method="post">
                  <input type="hidden" name="badgeId" value={b.id} />
                  <button
                    type="submit"
                    name="intent"
                    value="badge_toggle"
                    className="text-xs px-3 py-1 rounded-md"
                    style={{
                      background: "var(--color-bg-elev-2)",
                      border: "1px solid var(--color-border)",
                      color: b.isActive ? "var(--color-success)" : "var(--color-text-faint)",
                    }}
                  >
                    {b.isActive ? "Active" : "Inactive"}
                  </button>
                </Form>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}

export default function AdminPage() {
  const data = useLoaderData<typeof loader>();
  const nav = useNavigation();
  const submitting = nav.state === "submitting";
  const [params] = useSearchParams();
  const tab = (params.get("tab") as Tab | null) ?? "users";

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header user={data.user} />
      <AppShell>
        <div className="py-6 max-w-2xl">
          <h1 className="text-xl font-semibold mb-5" style={{ color: "var(--color-text)" }}>
            Platform Admin
          </h1>

          {/* Tab nav */}
          <div className="flex gap-1 flex-wrap">
            {TABS.map((t) => (
              <Link
                key={t.id}
                to={`?tab=${t.id}`}
                className="px-4 py-1.5 text-sm font-medium rounded-md no-underline"
                style={{
                  background:
                    tab === t.id
                      ? "var(--color-accent, var(--color-text))"
                      : "var(--color-bg-elev-1)",
                  color: tab === t.id ? "var(--color-bg)" : "var(--color-text-dim)",
                  border: `1px solid ${tab === t.id ? "transparent" : "var(--color-border)"}`,
                }}
              >
                {t.label}
              </Link>
            ))}
          </div>

          {tab === "users" && <UsersTab submitting={submitting} />}
          {tab === "communities" && <CommunitiesTab submitting={submitting} />}
          {tab === "feedback" && <FeedbackTab data={data} submitting={submitting} />}
          {tab === "appeals" && <AppealsTab data={data} submitting={submitting} />}
          {tab === "pioneer" && <PioneerTab data={data} submitting={submitting} />}
          {tab === "config" && <ConfigTab data={data} />}
        </div>
      </AppShell>
      <Footer />
    </div>
  );
}
