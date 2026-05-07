import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Link, useLoaderData, useSearchParams } from "@remix-run/react";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { communities, posts, users } from "../../db/schema";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [{ title: "Cormunities" }];
  const description =
    data.community.tagline ||
    data.community.description ||
    `Posts in c/${data.community.slug} on CORE`;
  return [
    { title: `c/${data.community.slug} — CORE` },
    { name: "description", content: description },
    { property: "og:title", content: `c/${data.community.slug} — CORE` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
  ];
};

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const db = createDb(env.DB);
  const url = new URL(request.url);
  const sort = (url.searchParams.get("sort") ?? "hot") as "hot" | "new" | "top";

  const community = await db.query.communities.findFirst({
    where: and(eq(communities.slug, params.slug ?? ""), isNull(communities.deletedAt)),
    columns: { id: true, slug: true, name: true, description: true, tagline: true },
  });
  if (!community) throw new Response("Community not found", { status: 404 });

  const user = await getCurrentUser(request, env);

  const baseWhere = and(eq(posts.communityId, community.id), isNull(posts.removedAt));
  const orderBy =
    sort === "new" ? desc(posts.createdAt) : sort === "top" ? desc(posts.score) : desc(posts.score); // hot: use score until hotScore column is added

  const rows = await db
    .select({
      id: posts.id,
      title: posts.title,
      type: posts.type,
      score: posts.score,
      commentCount: posts.commentCount,
      isPinned: posts.isPinned,
      createdAt: posts.createdAt,
      authorHandle: users.handle,
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(baseWhere)
    .orderBy(orderBy)
    .limit(50);

  return { community, posts: rows, sort, user };
}

export default function CommunityFeed() {
  const { community, posts: rows, sort, user } = useLoaderData<typeof loader>();
  const [, setSearchParams] = useSearchParams();

  return (
    <div className="flex flex-col gap-3 py-4">
      {/* Sort controls */}
      <div className="flex items-center gap-2 mb-2">
        {(["hot", "new", "top"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSearchParams(s === "hot" ? {} : { sort: s })}
            className="px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors"
            style={
              sort === s
                ? { background: "var(--color-bg-elev-2)", color: "var(--color-text)" }
                : { color: "var(--color-text-faint)" }
            }
          >
            {s}
          </button>
        ))}
        <div className="flex-1" />
        {user && (
          <Link
            to={`/c/${community.slug}/submit`}
            className="px-3 py-1 text-xs font-medium rounded-md no-underline"
            style={{ background: "var(--color-text)", color: "var(--color-bg)" }}
          >
            + Post
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <div
          className="rounded-lg p-8 text-center"
          style={{
            background: "var(--color-bg-elev-1)",
            border: "1px solid var(--color-border)",
          }}
        >
          <p className="text-sm" style={{ color: "var(--color-text-dim)" }}>
            No posts yet. Be the first to post!
          </p>
        </div>
      ) : (
        rows.map((post) => <PostCard key={post.id} post={post} communitySlug={community.slug} />)
      )}
    </div>
  );
}

function PostCard({
  post,
  communitySlug,
}: {
  post: {
    id: string;
    title: string;
    type: string;
    score: number;
    commentCount: number;
    isPinned: boolean;
    createdAt: string;
    authorHandle: string;
  };
  communitySlug: string;
}) {
  return (
    <div
      className="rounded-lg p-4 flex gap-3"
      style={{
        background: "var(--color-bg-elev-1)",
        border: "1px solid var(--color-border)",
      }}
    >
      {/* Vote score */}
      <div className="flex flex-col items-center gap-0.5 flex-shrink-0 w-8 text-center">
        <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          {post.score}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          {post.isPinned && (
            <span className="text-xs font-medium" style={{ color: "var(--color-success)" }}>
              📌
            </span>
          )}
          <Link
            to={`/c/${communitySlug}/p/${post.id}`}
            className="text-sm font-medium no-underline hover:underline leading-snug"
            style={{ color: "var(--color-text)" }}
          >
            {post.title}
          </Link>
        </div>

        <div
          className="flex items-center gap-3 text-xs"
          style={{ color: "var(--color-text-faint)" }}
        >
          <span>by {post.authorHandle}</span>
          <span>{relativeTime(post.createdAt)}</span>
          <Link
            to={`/c/${communitySlug}/p/${post.id}`}
            className="no-underline hover:underline"
            style={{ color: "var(--color-text-faint)" }}
          >
            {post.commentCount} comment{post.commentCount !== 1 ? "s" : ""}
          </Link>
        </div>
      </div>
    </div>
  );
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
