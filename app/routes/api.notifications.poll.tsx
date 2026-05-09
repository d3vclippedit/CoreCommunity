import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { communities, notifications, posts, users } from "../../db/schema";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) return Response.json({ unreadCount: 0, recentNotifs: [] });

  const db = createDb(env.DB);

  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      actorHandle: users.handle,
      actorDisplayName: users.displayName,
      communitySlug: communities.slug,
      communityName: communities.name,
      postId: notifications.postId,
      postTitle: posts.title,
    })
    .from(notifications)
    .leftJoin(users, eq(notifications.actorId, users.id))
    .leftJoin(communities, eq(notifications.communityId, communities.id))
    .leftJoin(posts, eq(notifications.postId, posts.id))
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(7);

  return Response.json({
    unreadCount: rows.filter((r) => !r.readAt).length,
    recentNotifs: rows,
  });
}
