import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Link, useLoaderData, useSearchParams } from "@remix-run/react";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { InlineMedia, detectEmbed } from "~/components/PostExpand";
import { getCurrentUser } from "~/lib/auth/user.server";
import { getBulkPostBadgeSummary } from "~/lib/badges.server";
import { createDb } from "~/lib/db/index";
import {
  communities,
  communityMemberships,
  communitySubscriptions,
  posts,
  users,
} from "../../db/schema";

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

  // Check if viewer is a subscriber or staff so we can reveal members-only posts
  let canSeeMembersOnly = false;
  if (user) {
    const membership = await db.query.communityMemberships.findFirst({
      where: and(
        eq(communityMemberships.userId, user.id),
        eq(communityMemberships.communityId, community.id),
      ),
      columns: { role: true },
    });
    const isStaff =
      membership?.role === "mod" ||
      membership?.role === "senior_mod" ||
      membership?.role === "admin" ||
      membership?.role === "streamer";
    if (isStaff) {
      canSeeMembersOnly = true;
    } else {
      const sub = await db.query.communitySubscriptions.findFirst({
        where: and(
          eq(communitySubscriptions.userId, user.id),
          eq(communitySubscriptions.communityId, community.id),
          eq(communitySubscriptions.status, "active"),
        ),
        columns: { id: true },
      });
      if (sub) canSeeMembersOnly = true;
    }
  }

  const baseWhere = and(eq(posts.communityId, community.id), isNull(posts.removedAt));
  const orderBy =
    sort === "new" ? desc(posts.createdAt) : sort === "top" ? desc(posts.score) : desc(posts.score); // hot: use score until hotScore column is added

  const rows = await db
    .select({
      id: posts.id,
      title: posts.title,
      type: posts.type,
      url: posts.url,
      imageUrl: posts.imageUrl,
      body: posts.body,
      embedKind: posts.embedKind,
      embedRef: posts.embedRef,
      visibility: posts.visibility,
      score: posts.score,
      commentCount: posts.commentCount,
      isPinned: posts.isPinned,
      createdAt: posts.createdAt,
      authorId: posts.authorId,
      authorHandle: users.handle,
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(baseWhere)
    .orderBy(orderBy)
    .limit(100);

  const postIds = rows.map((r) => r.id);
  const badgeRows = await getBulkPostBadgeSummary(db, postIds);

  const badgeMap = new Map<string, typeof badgeRows>();
  for (const b of badgeRows) {
    if (!badgeMap.has(b.postId)) badgeMap.set(b.postId, []);
    badgeMap.get(b.postId)?.push(b);
  }

  // Find which post authors are active subscribers to this community
  const uniqueAuthorIds = [...new Set(rows.map((r) => r.authorId))];
  const subscriberAuthorIds =
    uniqueAuthorIds.length > 0
      ? new Set(
          (
            await db
              .select({ userId: communitySubscriptions.userId })
              .from(communitySubscriptions)
              .where(
                and(
                  eq(communitySubscriptions.communityId, community.id),
                  eq(communitySubscriptions.status, "active"),
                  inArray(communitySubscriptions.userId, uniqueAuthorIds),
                ),
              )
          ).map((s) => s.userId),
        )
      : new Set<string>();

  const enriched = rows.map((p) => {
    const badges = badgeMap.get(p.id) ?? [];
    const badgeCoinsCC = badges.reduce((s, b) => s + b.totalCoins, 0);
    return {
      ...p,
      badgeCoinsCC,
      isSubscriber: subscriberAuthorIds.has(p.authorId),
      badges: badges.map((b) => ({
        icon: b.icon,
        name: b.name,
        count: b.count,
        totalCoins: b.totalCoins,
      })),
    } as typeof p & {
      badgeCoinsCC: number;
      isSubscriber: boolean;
      badges: { icon: string; name: string; count: number; totalCoins: number }[];
    };
  });

  if (sort !== "new") {
    enriched.sort((a, b) => b.score + b.badgeCoinsCC / 11 - (a.score + a.badgeCoinsCC / 11));
  }

  const visible = canSeeMembersOnly
    ? enriched
    : enriched.filter((p) => p.visibility !== "members_only");

  return { community, posts: visible.slice(0, 50), sort, user, canSeeMembersOnly };
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

function formatCC(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

type PostCardPost = {
  id: string;
  title: string;
  type: string;
  url: string | null;
  imageUrl: string | null;
  body: string | null;
  embedKind: string | null;
  embedRef: string | null;
  visibility: string;
  score: number;
  commentCount: number;
  isPinned: boolean;
  createdAt: string;
  authorHandle: string;
  badgeCoinsCC: number;
  isSubscriber: boolean;
  badges: { icon: string; name: string; count: number; totalCoins: number }[];
};

function PostCard({
  post,
  communitySlug,
}: {
  post: PostCardPost;
  communitySlug: string;
}) {
  const caption = post.body ? post.body.replace(/<[^>]*>/g, "").trim() : null;

  const hasMedia =
    (post.type === "image" && !!post.imageUrl) ||
    ((post.type === "video" || post.type === "link") &&
      (!!post.embedKind || (!!post.url && !!detectEmbed(post.url))));

  const cardInner = (
    <div
      className="post-card rounded-lg p-4"
      style={{
        background: "var(--color-bg-elev-1)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div className="flex flex-col gap-2">
        <div className="flex gap-3 items-start">
          {/* Text content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-1.5 mb-1">
              {post.isPinned && (
                <span
                  className="text-xs font-medium flex-shrink-0 mt-0.5"
                  style={{ color: "var(--color-success)" }}
                >
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
              {(post.type === "image" || post.type === "video" || post.type === "link") && (
                <span
                  className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded mt-0.5"
                  style={{ background: "var(--color-bg-elev-2)", color: "var(--color-text-faint)" }}
                >
                  {post.type}
                </span>
              )}
              {post.visibility === "members_only" && (
                <span className="members-only-badge flex-shrink-0 mt-0.5">Members</span>
              )}
            </div>

            {caption && (
              <p
                className="text-xs mb-1.5 leading-relaxed"
                style={{
                  color: "var(--color-text-dim)",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {caption}
              </p>
            )}

            {post.badges.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  {post.badges.slice(0, 4).map((b) => (
                    <span
                      key={b.name}
                      className="text-sm leading-none"
                      title={`${b.name} ×${b.count}`}
                    >
                      {b.icon}
                    </span>
                  ))}
                </div>
                <span
                  className="text-xs font-semibold tabular-nums"
                  style={{ color: "var(--color-text-faint)" }}
                >
                  {formatCC(post.badgeCoinsCC)} cc
                </span>
              </div>
            )}
          </div>

          {/* Inline media — always visible, right side */}
          {hasMedia && (
            <div
              className="flex-shrink-0 rounded-lg overflow-hidden"
              style={{
                width: "min(550px, 55%)",
                background: "var(--color-bg-elev-2)",
                border: "1px solid var(--color-border)",
              }}
            >
              <InlineMedia
                type={post.type}
                url={post.url}
                imageUrl={post.imageUrl}
                embedKind={post.embedKind}
                embedRef={post.embedRef}
              />
            </div>
          )}

          {/* Score — right of media */}
          <div className="flex-shrink-0 text-center" style={{ minWidth: 48 }}>
            <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
              {post.score}
            </span>
          </div>
        </div>

        {/* Meta row — bottom of card */}
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

  return cardInner;
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
