/**
 * Generic mod action endpoint — handles pin, feature, resolve-report, ban, timeout.
 * POST with `action` field describing the operation.
 */
import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";
import { and, eq, isNull } from "drizzle-orm";
import { getCurrentUser, requireUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { canBanUser, canFeaturePost, canPinPost, canTimeoutUser, isStaff } from "~/lib/permissions";
import { generateId } from "~/lib/utils";
import {
  bans,
  communities,
  communityMemberships,
  moderationActions,
  posts,
  reports,
} from "../../db/schema";

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const user = requireUser(await getCurrentUser(request, env));
  const db = createDb(env.DB);

  const form = await request.formData();
  const action = form.get("action") as string | null;
  const communitySlug = form.get("communitySlug") as string | null;
  const redirectTo = (form.get("redirectTo") as string | null) ?? "/";

  if (!action || !communitySlug) return { error: "Missing required fields." };

  const community = await db.query.communities.findFirst({
    where: and(eq(communities.slug, communitySlug), isNull(communities.deletedAt)),
    columns: { id: true, slug: true },
  });
  if (!community) return { error: "Community not found." };

  const membership = await db.query.communityMemberships.findFirst({
    where: and(
      eq(communityMemberships.userId, user.id),
      eq(communityMemberships.communityId, community.id),
    ),
    columns: { role: true },
  });

  const role = membership?.role;
  const isAdmin = user.isPlatformAdmin;
  const now = new Date();

  // ── Pin post ───────────────────────────────────────────────────────────────
  if (action === "pin" || action === "unpin") {
    if (!canPinPost(role) && !isAdmin) return { error: "Forbidden." };
    const postId = form.get("postId") as string | null;
    if (!postId) return { error: "Missing postId." };

    await db
      .update(posts)
      .set({ isPinned: action === "pin", updatedAt: now })
      .where(eq(posts.id, postId));

    await db.insert(moderationActions).values({
      id: generateId(),
      communityId: community.id,
      actorId: user.id,
      action: "pin_post",
      targetType: "post",
      targetId: postId,
      metadata: JSON.stringify({ pinned: action === "pin" }),
      createdAt: now,
    });

    return redirect(redirectTo);
  }

  // ── Feature post ──────────────────────────────────────────────────────────
  if (action === "feature" || action === "unfeature") {
    if (!canFeaturePost(role) && !isAdmin) return { error: "Forbidden." };
    const postId = form.get("postId") as string | null;
    if (!postId) return { error: "Missing postId." };

    await db
      .update(posts)
      .set({ isFeatured: action === "feature", updatedAt: now })
      .where(eq(posts.id, postId));

    await db.insert(moderationActions).values({
      id: generateId(),
      communityId: community.id,
      actorId: user.id,
      action: "feature_post",
      targetType: "post",
      targetId: postId,
      metadata: JSON.stringify({ featured: action === "feature" }),
      createdAt: now,
    });

    return redirect(redirectTo);
  }

  // ── Resolve report ────────────────────────────────────────────────────────
  if (action === "resolve_report" || action === "dismiss_report") {
    if (!isStaff(role) && !isAdmin) return { error: "Forbidden." };
    const reportId = form.get("reportId") as string | null;
    if (!reportId) return { error: "Missing reportId." };

    await db
      .update(reports)
      .set({
        status: action === "resolve_report" ? "actioned" : "dismissed",
        resolvedByUserId: user.id,
        resolvedAt: now,
      })
      .where(eq(reports.id, reportId));

    return redirect(redirectTo);
  }

  // ── Timeout user ──────────────────────────────────────────────────────────
  if (action === "timeout") {
    if (!canTimeoutUser(role) && !isAdmin) return { error: "Forbidden." };
    const targetUserId = form.get("targetUserId") as string | null;
    const durationHours = Number(form.get("durationHours") ?? 24);
    const reason = (form.get("reason") as string | null)?.trim() || null;
    if (!targetUserId) return { error: "Missing targetUserId." };

    const expiresAt = new Date(Date.now() + durationHours * 3600 * 1000);

    await db.insert(bans).values({
      id: generateId(),
      communityId: community.id,
      userId: targetUserId,
      mutedByUserId: user.id,
      type: "timeout",
      expiresAt,
      reason,
      createdAt: now,
    });

    await db.insert(moderationActions).values({
      id: generateId(),
      communityId: community.id,
      actorId: user.id,
      action: "timeout_user",
      targetType: "user",
      targetId: targetUserId,
      metadata: JSON.stringify({ durationHours, reason }),
      createdAt: now,
    });

    return redirect(redirectTo);
  }

  // ── Ban user ──────────────────────────────────────────────────────────────
  if (action === "ban") {
    if (!canBanUser(role) && !isAdmin) return { error: "Forbidden." };
    const targetUserId = form.get("targetUserId") as string | null;
    const reason = (form.get("reason") as string | null)?.trim() || null;
    if (!targetUserId) return { error: "Missing targetUserId." };

    await db.insert(bans).values({
      id: generateId(),
      communityId: community.id,
      userId: targetUserId,
      mutedByUserId: user.id,
      type: "ban",
      expiresAt: null,
      reason,
      createdAt: now,
    });

    await db.insert(moderationActions).values({
      id: generateId(),
      communityId: community.id,
      actorId: user.id,
      action: "ban_user",
      targetType: "user",
      targetId: targetUserId,
      metadata: reason ? JSON.stringify({ reason }) : null,
      createdAt: now,
    });

    return redirect(redirectTo);
  }

  return { error: "Unknown action." };
}

export async function loader() {
  return redirect("/");
}
