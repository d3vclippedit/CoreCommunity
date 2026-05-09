import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { communities, communityNotificationPrefs } from "../../db/schema";

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) return Response.json({ error: "Not signed in." }, { status: 401 });

  const form = await request.formData();
  const communityId = form.get("communityId") as string | null;
  const enabled = form.get("enabled") === "1";

  if (!communityId) return Response.json({ error: "Missing communityId." }, { status: 400 });

  const db = createDb(env.DB);

  const community = await db.query.communities.findFirst({
    where: eq(communities.id, communityId),
    columns: { id: true },
  });
  if (!community) return Response.json({ error: "Community not found." }, { status: 404 });

  const existing = await db.query.communityNotificationPrefs.findFirst({
    where: and(
      eq(communityNotificationPrefs.userId, user.id),
      eq(communityNotificationPrefs.communityId, communityId),
    ),
  });

  if (existing) {
    await db
      .update(communityNotificationPrefs)
      .set({ notifyNewPosts: enabled })
      .where(
        and(
          eq(communityNotificationPrefs.userId, user.id),
          eq(communityNotificationPrefs.communityId, communityId),
        ),
      );
  } else {
    await db.insert(communityNotificationPrefs).values({
      userId: user.id,
      communityId,
      notifyNewPosts: enabled,
    });
  }

  return Response.json({ success: true, enabled });
}
