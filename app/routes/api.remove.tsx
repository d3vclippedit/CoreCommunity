import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { json, redirect } from "@remix-run/cloudflare";
import { and, eq, isNull } from "drizzle-orm";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { canRemoveComment, canRemovePost } from "~/lib/permissions";
import { generateId } from "~/lib/utils";
import {
  comments,
  communities,
  communityMemberships,
  moderationActions,
  posts,
  reports,
} from "../../db/schema";

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) return json({ error: "Unauthorized" }, { status: 401 });
  const db = createDb(env.DB);

  const form = await request.formData();
  const targetType = form.get("targetType") as "post" | "comment" | null;
  const targetId = form.get("targetId") as string | null;
  const communitySlug = form.get("communitySlug") as string | null;
  const reason = (form.get("reason") as string | null)?.trim() || null;
  const redirectTo = (form.get("redirectTo") as string | null) ?? "/";

  if (!targetType || !targetId || !communitySlug) {
    return { error: "Missing required fields." };
  }

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

  if (targetType === "post") {
    if (!canRemovePost(role) && !isAdmin) return { error: "Forbidden." };

    await db
      .update(posts)
      .set({ removedAt: now, removedByUserId: user.id, removedReason: reason, updatedAt: now })
      .where(eq(posts.id, targetId));

    // Close any open reports for this post
    await db
      .update(reports)
      .set({ status: "actioned", resolvedByUserId: user.id, resolvedAt: now })
      .where(
        and(
          eq(reports.targetId, targetId),
          eq(reports.targetType, "post"),
          eq(reports.status, "open"),
        ),
      );
  } else {
    if (!canRemoveComment(role) && !isAdmin) return { error: "Forbidden." };

    await db
      .update(comments)
      .set({ removedAt: now, removedByUserId: user.id, removedReason: reason, updatedAt: now })
      .where(eq(comments.id, targetId));

    await db
      .update(reports)
      .set({ status: "actioned", resolvedByUserId: user.id, resolvedAt: now })
      .where(
        and(
          eq(reports.targetId, targetId),
          eq(reports.targetType, "comment"),
          eq(reports.status, "open"),
        ),
      );
  }

  // Audit log
  await db.insert(moderationActions).values({
    id: generateId(),
    communityId: community.id,
    actorId: user.id,
    action: targetType === "post" ? "remove_post" : "remove_comment",
    targetType,
    targetId,
    metadata: reason ? JSON.stringify({ reason }) : null,
    createdAt: now,
  });

  return redirect(redirectTo);
}

export async function loader() {
  return redirect("/");
}
