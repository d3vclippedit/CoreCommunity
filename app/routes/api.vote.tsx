import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";
import { and, eq, sql } from "drizzle-orm";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { checkRateLimit } from "~/lib/ratelimit";
import { comments, posts, votes } from "../../db/schema";

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) return { error: "Unauthorized" };

  const rl = await checkRateLimit(env.KV, "vote", user.id, 60, 60);
  if (!rl.allowed) return { error: "Rate limit exceeded." };

  const form = await request.formData();
  const targetType = form.get("targetType") as "post" | "comment" | null;
  const targetId = form.get("targetId") as string | null;
  const rawValue = Number(form.get("value") ?? 0);
  const value = Math.max(-1, Math.min(1, Math.round(rawValue)));

  if (!targetType || !targetId) return { error: "Invalid request." };
  if (targetType !== "post" && targetType !== "comment") return { error: "Invalid target type." };

  const db = createDb(env.DB);
  const now = new Date();

  // Get existing vote
  const existing = await db.query.votes.findFirst({
    where: and(
      eq(votes.userId, user.id),
      eq(votes.targetType, targetType),
      eq(votes.targetId, targetId),
    ),
    columns: { value: true },
  });

  const oldValue = existing?.value ?? 0;
  const delta = value - oldValue;

  if (delta === 0) return { ok: true, score: null };

  if (existing) {
    await db
      .update(votes)
      .set({ value, updatedAt: now })
      .where(
        and(
          eq(votes.userId, user.id),
          eq(votes.targetType, targetType),
          eq(votes.targetId, targetId),
        ),
      );
  } else {
    await db.insert(votes).values({
      userId: user.id,
      targetType,
      targetId,
      value,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Update denormalized score
  if (targetType === "post") {
    const upDelta = (value > 0 ? 1 : 0) - (oldValue > 0 ? 1 : 0);
    const downDelta = (value < 0 ? 1 : 0) - (oldValue < 0 ? 1 : 0);
    await db
      .update(posts)
      .set({
        score: sql`${posts.score} + ${delta}`,
        upvotes: sql`${posts.upvotes} + ${upDelta}`,
        downvotes: sql`${posts.downvotes} + ${downDelta}`,
        updatedAt: now,
      })
      .where(eq(posts.id, targetId));
  } else {
    const upDelta = (value > 0 ? 1 : 0) - (oldValue > 0 ? 1 : 0);
    const downDelta = (value < 0 ? 1 : 0) - (oldValue < 0 ? 1 : 0);
    await db
      .update(comments)
      .set({
        score: sql`${comments.score} + ${delta}`,
        upvotes: sql`${comments.upvotes} + ${upDelta}`,
        downvotes: sql`${comments.downvotes} + ${downDelta}`,
        updatedAt: now,
      })
      .where(eq(comments.id, targetId));
  }

  return { ok: true, delta, newValue: value };
}

export async function loader() {
  return redirect("/");
}
