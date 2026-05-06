import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";
import { and, eq, sql } from "drizzle-orm";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { communities, communityMemberships } from "../../db/schema";

export async function action({ request, params, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) return redirect("/auth/login");

  const form = await request.formData();
  const communityId = form.get("communityId") as string | null;
  const act = form.get("action") as "join" | "leave" | null;

  if (!communityId || !act) return redirect(`/c/${params.slug}`);

  const db = createDb(env.DB);

  if (act === "join") {
    const existing = await db.query.communityMemberships.findFirst({
      where: and(
        eq(communityMemberships.userId, user.id),
        eq(communityMemberships.communityId, communityId),
      ),
    });
    if (!existing) {
      const now = new Date();
      await db.insert(communityMemberships).values({
        userId: user.id,
        communityId,
        role: "member",
        joinedAt: now,
        updatedAt: now,
      });
      await db
        .update(communities)
        .set({ memberCount: sql`${communities.memberCount} + 1` })
        .where(eq(communities.id, communityId));
    }
  } else {
    const existing = await db.query.communityMemberships.findFirst({
      where: and(
        eq(communityMemberships.userId, user.id),
        eq(communityMemberships.communityId, communityId),
      ),
    });
    if (existing && existing.role === "member") {
      await db
        .delete(communityMemberships)
        .where(
          and(
            eq(communityMemberships.userId, user.id),
            eq(communityMemberships.communityId, communityId),
          ),
        );
      await db
        .update(communities)
        .set({ memberCount: sql`max(0, ${communities.memberCount} - 1)` })
        .where(eq(communities.id, communityId));
    }
  }

  return redirect(`/c/${params.slug}`);
}

export async function loader() {
  return redirect("/communities");
}
