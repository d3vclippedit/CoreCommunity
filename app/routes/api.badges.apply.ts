import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { getCurrentUser } from "~/lib/auth/user.server";
import { applyBadge } from "~/lib/badges.server";
import { createDb } from "~/lib/db/index";

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.emailVerifiedAt)
    return Response.json({ error: "Verify your email before giving badges." }, { status: 403 });
  if ((user as { isBanned?: boolean }).isBanned)
    return Response.json({ error: "Account suspended." }, { status: 403 });

  const form = await request.formData();
  const postId = form.get("postId") as string | null;
  const badgeDefinitionId = form.get("badgeDefinitionId") as string | null;

  if (!postId || !badgeDefinitionId) {
    return Response.json({ error: "Missing postId or badgeDefinitionId" }, { status: 400 });
  }

  // Validate inputs are safe strings (no injection)
  if (!/^[a-zA-Z0-9_-]{6,64}$/.test(postId) || !/^[a-zA-Z0-9_-]{6,64}$/.test(badgeDefinitionId)) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  // Rate limit: 10 badge applications per minute per user
  const rlKey = `rl:badge:apply:${user.id}`;
  const rl = await env.KV.get(rlKey);
  if (rl && Number(rl) >= 10)
    return Response.json({ error: "Too many badge requests. Slow down." }, { status: 429 });
  await env.KV.put(rlKey, String(Number(rl ?? 0) + 1), { expirationTtl: 60 });

  const db = createDb(env.DB);

  try {
    const result = await applyBadge(db, user.id, postId, badgeDefinitionId);
    return Response.json({ success: true, newBalance: result.newBalance });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "INSUFFICIENT_BALANCE") {
        return Response.json({ error: "Not enough Core Coins." }, { status: 402 });
      }
      if (err.message === "BADGE_NOT_FOUND") {
        return Response.json({ error: "Badge not found." }, { status: 404 });
      }
      if (err.message === "POST_NOT_FOUND") {
        return Response.json({ error: "Post not found." }, { status: 404 });
      }
      if (err.message === "SELF_BADGE_NOT_ALLOWED") {
        return Response.json({ error: "You cannot badge your own posts." }, { status: 400 });
      }
    }
    console.error("Badge apply error:", err);
    return Response.json({ error: "Failed to apply badge." }, { status: 500 });
  }
}
