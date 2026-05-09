import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { and, desc, isNull, like, or } from "drizzle-orm";
import { createDb } from "~/lib/db/index";
import { communities, users } from "../../db/schema";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").toLowerCase().trim();
  const type = url.searchParams.get("type") ?? "user";

  if (!q) return Response.json([]);

  const db = createDb(env.DB);

  if (type === "community") {
    const rows = await db
      .select({ id: communities.id, slug: communities.slug, name: communities.name })
      .from(communities)
      .where(and(isNull(communities.deletedAt), like(communities.slug, `${q}%`)))
      .orderBy(desc(communities.memberCount))
      .limit(10);

    return Response.json(
      rows.map((c) => ({ id: c.slug, label: c.slug, name: c.name, type: "community" })),
    );
  }

  // User suggestions — match on handle prefix OR displayName prefix, sort by follower count
  const rows = await db
    .select({
      id: users.id,
      handle: users.handle,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      followerCount: users.followerCount,
    })
    .from(users)
    .where(
      and(
        isNull(users.deletedAt),
        or(like(users.handle, `${q}%`), like(users.displayName, `${q}%`)),
      ),
    )
    .orderBy(desc(users.followerCount))
    .limit(10);

  return Response.json(
    rows.map((u) => ({
      id: u.handle,
      label: u.handle,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      type: "user",
    })),
  );
}
