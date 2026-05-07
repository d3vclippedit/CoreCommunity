import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { followUser, unfollowUser } from "~/lib/follows.server";

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const targetUserId = form.get("targetUserId") as string | null;
  const intent = form.get("intent") as "follow" | "unfollow" | null;

  if (!targetUserId || !intent) {
    return Response.json({ error: "Missing targetUserId or intent" }, { status: 400 });
  }

  if (targetUserId === user.id) {
    return Response.json({ error: "Cannot follow yourself" }, { status: 400 });
  }

  const db = createDb(env.DB);

  try {
    if (intent === "follow") {
      await followUser(db, user.id, targetUserId);
      return Response.json({ following: true });
    } else {
      await unfollowUser(db, user.id, targetUserId);
      return Response.json({ following: false });
    }
  } catch (err) {
    console.error("Follow action error:", err);
    return Response.json({ error: "Action failed." }, { status: 500 });
  }
}
