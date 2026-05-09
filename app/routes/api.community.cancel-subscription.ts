import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { communitySubscriptions } from "../../db/schema";

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) return Response.json({ error: "Not signed in." }, { status: 401 });

  const form = await request.formData();
  const communityId = form.get("communityId") as string | null;
  if (!communityId) return Response.json({ error: "Missing communityId." }, { status: 400 });

  const db = createDb(env.DB);

  await db
    .update(communitySubscriptions)
    .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(communitySubscriptions.userId, user.id),
        eq(communitySubscriptions.communityId, communityId),
        eq(communitySubscriptions.status, "active"),
      ),
    );

  return Response.json({ success: true });
}
