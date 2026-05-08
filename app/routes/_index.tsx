import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Link, useLoaderData, useSearchParams } from "@remix-run/react";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { useEffect, useRef, useState } from "react";
import { CoreLogo } from "~/components/CoreLogo";
import { ExpandChevron, ExpandedPostContent, detectEmbed } from "~/components/PostExpand";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { getCurrentUser } from "~/lib/auth/user.server";
import { getBulkPostBadgeSummary } from "~/lib/badges.server";
import { createDb } from "~/lib/db/index";
import { communities, communityMemberships, follows, posts, users } from "../../db/schema";
import { CommunityAvatar } from "./communities._index";

export const meta: MetaFunction = () => [
  { title: "CORE — Communities for creators who actually run them" },
  {
    name: "description",
    content:
      "Cormunities is a creator-owned community platform — forum-style discussion, threaded posts, voting, and real moderation tools. Built for streamers and the people around them.",
  },
  { property: "og:title", content: "Cormunities" },
  { property: "og:description", content: "Communities for creators who actually run them." },
  { property: "og:type", content: "website" },
];

type Tab = "all" | "discover" | "following";
type Sort = "hot" | "new" | "top";

type FeedPost = {
  id: string;
  title: string;
  type: string; // "text" | "link" | "image" | "video"
  url: string | null;
  imageUrl: string | null;
  body: string | null;
  score: number;
  commentCount: number;
  isPinned: boolean;
  createdAt: string;
  authorHandle: string | null;
  communitySlug: string | null;
  communityName: string | null;
  communityIconUrl: string | null;
  badgeCoinsCC: number;
  badges: { icon: string; name: string; count: number; totalCoins: number }[];
};

type DiscoverCommunity = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  iconUrl: string | null;
  bannerUrl: string | null;
  accentColor: string | null;
  memberCount: number;
  isVerified: boolean;
};

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);

  if (!user) {
    return {
      user: null as null,
      tab: "all" as Tab,
      sort: "hot" as Sort,
      posts: [] as FeedPost[],
      discoverCommunities: [] as DiscoverCommunity[],
      joinedSlugs: [] as string[],
    };
  }

  const db = createDb(env.DB);
  const url = new URL(request.url);
  const tab = ((url.searchParams.get("tab") ?? "all") as Tab) || "all";
  const sort = ((url.searchParams.get("sort") ?? "hot") as Sort) || "hot";

  const memberships = await db
    .select({ communityId: communityMemberships.communityId })
    .from(communityMemberships)
    .where(eq(communityMemberships.userId, user.id));
  const joinedIds = memberships.map((m) => m.communityId);

  if (tab === "discover") {
    const allCommunities = await db
      .select({
        id: communities.id,
        slug: communities.slug,
        name: communities.name,
        tagline: communities.tagline,
        description: communities.description,
        iconUrl: communities.iconUrl,
        bannerUrl: communities.bannerUrl,
        accentColor: communities.accentColor,
        memberCount: communities.memberCount,
        isVerified: communities.isVerified,
      })
      .from(communities)
      .where(isNull(communities.deletedAt))
      .orderBy(desc(communities.memberCount))
      .limit(40);

    const unjoinedSet = new Set(joinedIds);
    const discoverCommunities = allCommunities.filter((c) => !unjoinedSet.has(c.id)).slice(0, 24);

    return {
      user,
      tab,
      sort,
      posts: [] as FeedPost[],
      discoverCommunities,
      joinedSlugs: [] as string[],
    };
  }

  const orderBy = sort === "new" ? desc(posts.createdAt) : desc(posts.score);

  // Following tab — posts from followed users + communities the user has joined
  if (tab === "following") {
    const followingRows = await db
      .select({ followeeId: follows.followeeId })
      .from(follows)
      .where(eq(follows.followerId, user.id));
    const followingIds = followingRows.map((r) => r.followeeId);

    const clauses = [
      ...(followingIds.length > 0 ? [inArray(posts.authorId, followingIds)] : []),
      ...(joinedIds.length > 0 ? [inArray(posts.communityId, joinedIds)] : []),
    ];

    if (clauses.length === 0) {
      return {
        user,
        tab,
        sort,
        posts: [] as FeedPost[],
        discoverCommunities: [] as DiscoverCommunity[],
        joinedSlugs: [] as string[],
      };
    }

    const followingFilter = clauses.length === 1 ? clauses[0] : or(...clauses);

    const rawPosts = await db
      .select({
        id: posts.id,
        title: posts.title,
        type: posts.type,
        url: posts.url,
        imageUrl: posts.imageUrl,
        body: posts.body,
        score: posts.score,
        commentCount: posts.commentCount,
        isPinned: posts.isPinned,
        createdAt: posts.createdAt,
        authorHandle: users.handle,
        communitySlug: communities.slug,
        communityName: communities.name,
        communityIconUrl: communities.iconUrl,
      })
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .innerJoin(
        communities,
        and(eq(posts.communityId, communities.id), isNull(communities.deletedAt)),
      )
      .where(and(isNull(posts.removedAt), followingFilter))
      .orderBy(orderBy)
      .limit(50);

    return {
      user,
      tab,
      sort,
      posts: rawPosts.map((p) => ({
        ...p,
        badgeCoinsCC: 0,
        badges: [] as { icon: string; name: string; count: number; totalCoins: number }[],
      })),
      discoverCommunities: [] as DiscoverCommunity[],
      joinedSlugs: [] as string[],
    };
  }

  // All posts — engagement-ranked
  const whereClause = isNull(posts.removedAt);

  const rawPosts = await db
    .select({
      id: posts.id,
      title: posts.title,
      type: posts.type,
      url: posts.url,
      imageUrl: posts.imageUrl,
      body: posts.body,
      score: posts.score,
      commentCount: posts.commentCount,
      isPinned: posts.isPinned,
      createdAt: posts.createdAt,
      authorHandle: users.handle,
      communitySlug: communities.slug,
      communityName: communities.name,
      communityIconUrl: communities.iconUrl,
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .innerJoin(
      communities,
      and(eq(posts.communityId, communities.id), isNull(communities.deletedAt)),
    )
    .where(whereClause)
    .orderBy(orderBy)
    .limit(100);

  const badgeRows = await getBulkPostBadgeSummary(
    db,
    rawPosts.map((p) => p.id),
  );

  const badgeMap = new Map<string, typeof badgeRows>();
  for (const b of badgeRows) {
    if (!badgeMap.has(b.postId)) badgeMap.set(b.postId, []);
    badgeMap.get(b.postId)?.push(b);
  }

  const feedPosts = rawPosts.map((p) => {
    const badges = badgeMap.get(p.id) ?? [];
    const badgeCoinsCC = badges.reduce((s, b) => s + b.totalCoins, 0);
    return {
      ...p,
      badgeCoinsCC,
      badges: badges.map((b) => ({
        icon: b.icon,
        name: b.name,
        count: b.count,
        totalCoins: b.totalCoins,
      })),
    };
  });

  if (sort !== "new") {
    feedPosts.sort((a, b) => b.score + b.badgeCoinsCC / 11 - (a.score + a.badgeCoinsCC / 11));
  }

  return {
    user,
    tab,
    sort,
    posts: feedPosts.slice(0, 50),
    discoverCommunities: [] as DiscoverCommunity[],
    joinedSlugs: [] as string[],
  };
}

export default function Index() {
  const { user, tab, sort, posts: feedPosts, discoverCommunities } = useLoaderData<typeof loader>();
  const [, setSearchParams] = useSearchParams();

  if (!user) return <LandingPage />;

  const setTab = (t: Tab) => setSearchParams(t === "all" ? {} : { tab: t });
  const setSort = (s: Sort) =>
    setSearchParams(
      s === "hot" ? (tab === "all" ? {} : { tab }) : tab === "all" ? { sort: s } : { tab, sort: s },
    );

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header user={user} />
      <AppShell>
        <div className="py-4">
          {/* Tab bar */}
          <div
            className="flex items-center gap-1 mb-4 rounded-lg p-1"
            style={{
              background: "var(--color-bg-elev-1)",
              border: "1px solid var(--color-border)",
            }}
          >
            {(["all", "following", "discover"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className="flex-1 py-1.5 text-sm font-medium rounded-md transition-colors"
                style={
                  tab === t
                    ? { background: "var(--color-bg-elev-2)", color: "var(--color-text)" }
                    : { color: "var(--color-text-faint)" }
                }
              >
                {t === "all" ? "All Posts" : t === "following" ? "Following" : "Discover"}
              </button>
            ))}
          </div>

          {/* Sort controls (only for post tabs) */}
          {tab !== "discover" && tab !== "following" && (
            <div className="flex items-center gap-2 mb-4">
              {(["hot", "new", "top"] as Sort[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSort(s)}
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
            </div>
          )}

          {/* Feed content */}
          {tab === "discover" ? (
            <DiscoverGrid communities={discoverCommunities} />
          ) : feedPosts.length === 0 ? (
            <EmptyFeed tab={tab} />
          ) : (
            <div className="flex flex-col gap-2">
              {feedPosts.map((post) => (
                <FeedPostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </AppShell>
      <Footer />
    </div>
  );
}

const FEED_MILESTONE_TIERS = [
  {
    min: 500_000,
    label: "Legendary",
    className: "post-milestone-legendary",
    color: "rgba(255,60,120,1)",
    borderColor: "rgba(255,60,120,0.9)",
    bg: "rgba(255,60,120,0.1)",
  },
  {
    min: 100_000,
    label: "Gold",
    className: "post-milestone-gold",
    color: "rgba(255,196,0,1)",
    borderColor: "rgba(255,196,0,0.85)",
    bg: "rgba(255,196,0,0.1)",
  },
  {
    min: 25_000,
    label: "Silver",
    className: "post-milestone-silver",
    color: "rgba(200,205,240,1)",
    borderColor: "rgba(200,205,240,0.75)",
    bg: "rgba(200,205,240,0.08)",
  },
  {
    min: 10_000,
    label: "Bronze",
    className: "post-milestone-bronze",
    color: "rgba(205,127,50,1)",
    borderColor: "rgba(205,127,50,0.75)",
    bg: "rgba(205,127,50,0.1)",
  },
];

function getFeedMilestoneTier(cc: number) {
  return FEED_MILESTONE_TIERS.find((t) => cc >= t.min) ?? null;
}

function formatFeedCC(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function FeedPostCard({ post }: { post: FeedPost }) {
  const [expanded, setExpanded] = useState(false);
  const tier = getFeedMilestoneTier(post.badgeCoinsCC);
  const caption = post.body ? post.body.replace(/<[^>]*>/g, "").trim() : null;

  const isExpandable =
    (post.type === "image" && !!post.imageUrl) ||
    (post.type === "video" && !!post.url) ||
    (post.type === "text" && !!post.body) ||
    (post.type === "link" && !!post.url && !!detectEmbed(post.url));

  const hasThumb =
    !expanded && ((post.type === "image" && !!post.imageUrl) || post.type === "video");
  const ytId =
    post.type === "video"
      ? post.url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1]
      : null;

  return (
    <div
      className={`post-card rounded-lg p-4${tier ? ` ${tier.className}` : ""}${isExpandable ? " cursor-pointer select-none" : ""}`}
      style={{
        background: expanded ? "var(--color-bg-elev-2)" : "var(--color-bg-elev-1)",
        border: `1px solid ${tier ? tier.borderColor : "var(--color-border)"}`,
        transition: "background 0.15s ease",
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button")) return;
        if (isExpandable) setExpanded((v) => !v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if (isExpandable) setExpanded((v) => !v);
        }
      }}
    >
      {/* Top row */}
      <div className="flex gap-4">
        {/* Community icon */}
        <Link
          to={`/c/${post.communitySlug}`}
          className="flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <CommunityAvatar
            name={post.communityName ?? ""}
            iconUrl={post.communityIconUrl}
            size={40}
          />
        </Link>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <Link
              to={`/c/${post.communitySlug}`}
              className="no-underline group"
              onClick={(e) => e.stopPropagation()}
            >
              <span
                className="text-xs font-medium group-hover:underline"
                style={{ color: "var(--color-text-dim)" }}
              >
                c/{post.communitySlug}
              </span>
            </Link>
            <span
              className="text-xs font-semibold tabular-nums"
              style={{ color: "var(--color-text-faint)" }}
            >
              {post.score} pts
            </span>
          </div>

          <div className="flex items-start gap-2 mb-1">
            {post.isPinned && (
              <span
                className="text-xs mt-0.5 flex-shrink-0"
                style={{ color: "var(--color-success)" }}
              >
                📌
              </span>
            )}
            <Link
              to={`/c/${post.communitySlug}/p/${post.id}`}
              className="text-sm font-medium no-underline hover:underline leading-snug"
              style={{ color: "var(--color-text)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {post.title}
            </Link>
            {post.type === "link" && post.url && (
              <span
                className="text-xs flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded"
                style={{ background: "var(--color-bg-elev-2)", color: "var(--color-text-faint)" }}
              >
                {(() => {
                  try {
                    return new URL(post.url).hostname;
                  } catch {
                    return "link";
                  }
                })()}
              </span>
            )}
            {(post.type === "image" || post.type === "video") && (
              <span
                className="text-xs flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded"
                style={{ background: "var(--color-bg-elev-2)", color: "var(--color-text-faint)" }}
              >
                {post.type}
              </span>
            )}
          </div>

          {caption && !expanded && (
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
            <div className="flex items-center gap-2 mb-1.5">
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
                style={{ color: tier ? tier.color : "var(--color-text-faint)" }}
              >
                {formatFeedCC(post.badgeCoinsCC)} cc
              </span>
              {tier && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: tier.bg, color: tier.color }}
                >
                  {tier.label}
                </span>
              )}
            </div>
          )}

          <div
            className="flex items-center gap-3 text-xs flex-wrap"
            style={{ color: "var(--color-text-faint)" }}
          >
            <span>by {post.authorHandle}</span>
            <span>{relativeTime(post.createdAt)}</span>
            <Link
              to={`/c/${post.communitySlug}/p/${post.id}`}
              className="no-underline hover:underline"
              style={{ color: "var(--color-text-faint)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {post.commentCount} comment{post.commentCount !== 1 ? "s" : ""}
            </Link>
          </div>
        </div>

        {/* Thumbnail (collapsed only) */}
        {hasThumb && (
          <div
            className="post-thumb flex-shrink-0 relative flex items-center justify-center"
            style={{
              width: 140,
              height: 100,
              background: "var(--color-bg-elev-2)",
              border: "1px solid var(--color-border)",
            }}
          >
            {post.type === "image" && post.imageUrl && (
              <img
                src={post.imageUrl}
                alt=""
                loading="lazy"
                className="w-full h-full"
                style={{ objectFit: "contain" }}
              />
            )}
            {post.type === "video" && (
              <>
                {ytId && (
                  <img
                    src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
                <div
                  className="relative z-10 flex items-center justify-center rounded-full"
                  style={{
                    width: 34,
                    height: 34,
                    background: ytId ? "rgba(0,0,0,0.55)" : "rgba(245,245,247,0.06)",
                    border: "1.5px solid rgba(245,245,247,0.25)",
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 11 11"
                    fill="currentColor"
                    style={{ color: "var(--color-text)", marginLeft: 2 }}
                    aria-hidden="true"
                  >
                    <path d="M1.5 1.5L9.5 5.5L1.5 9.5V1.5Z" />
                  </svg>
                </div>
              </>
            )}
          </div>
        )}

        {/* Expand chevron */}
        {isExpandable && <ExpandChevron expanded={expanded} />}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="expand-in mt-3 pt-3" style={{ borderTop: "1px solid var(--color-border)" }}>
          {caption && post.type !== "text" && (
            <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--color-text-dim)" }}>
              {caption}
            </p>
          )}
          <ExpandedPostContent
            type={post.type}
            url={post.url}
            imageUrl={post.imageUrl}
            body={post.body}
            title={post.title}
          />
        </div>
      )}
    </div>
  );
}

function DiscoverGrid({ communities: items }: { communities: DiscoverCommunity[] }) {
  if (items.length === 0) {
    return (
      <div
        className="rounded-lg p-8 text-center"
        style={{ background: "var(--color-bg-elev-1)", border: "1px solid var(--color-border)" }}
      >
        <p className="text-sm mb-3" style={{ color: "var(--color-text-dim)" }}>
          You've joined all available communities — nothing left to discover!
        </p>
        <Link
          to="/communities"
          className="text-sm no-underline hover:underline"
          style={{ color: "var(--color-text)" }}
        >
          Browse communities →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map((c) => (
        <DiscoverCard key={c.id} community={c} />
      ))}
    </div>
  );
}

function DiscoverCard({ community: c }: { community: DiscoverCommunity }) {
  const accent = c.accentColor ?? "var(--color-text-faint)";
  return (
    <Link
      to={`/c/${c.slug}`}
      className="rounded-lg overflow-hidden no-underline flex flex-col transition-opacity hover:opacity-90"
      style={{ background: "var(--color-bg-elev-1)", border: "1px solid var(--color-border)" }}
    >
      {/* Banner / accent header */}
      <div className="relative flex-shrink-0" style={{ height: "72px" }}>
        {c.bannerUrl ? (
          <img src={c.bannerUrl} alt="" aria-hidden="true" className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: `linear-gradient(135deg, ${accent}44 0%, var(--color-bg-elev-2) 100%)`,
            }}
          />
        )}
        <div className="absolute bottom-0 translate-y-1/2 left-3">
          <CommunityAvatar name={c.name} iconUrl={c.iconUrl} size={40} />
        </div>
      </div>

      <div className="px-3 pb-3 pt-6">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
              {c.name}
              {c.isVerified && (
                <span className="ml-1.5 text-xs" style={{ color: "var(--color-success)" }}>
                  ✓
                </span>
              )}
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
              c/{c.slug}
            </p>
          </div>
          <span
            className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: "var(--color-bg-elev-2)", color: "var(--color-text-dim)" }}
          >
            Join →
          </span>
        </div>
        {(c.tagline || c.description) && (
          <p
            className="text-xs mt-2 line-clamp-2 leading-relaxed"
            style={{ color: "var(--color-text-dim)" }}
          >
            {c.tagline || c.description}
          </p>
        )}
        <p className="text-xs mt-2" style={{ color: "var(--color-text-faint)" }}>
          {c.memberCount.toLocaleString()} members
        </p>
      </div>
    </Link>
  );
}

function EmptyFeed({ tab }: { tab: Tab }) {
  return (
    <div
      className="rounded-lg p-8 text-center"
      style={{ background: "var(--color-bg-elev-1)", border: "1px solid var(--color-border)" }}
    >
      {tab === "following" ? (
        <>
          <p className="text-sm mb-2" style={{ color: "var(--color-text-dim)" }}>
            Nothing here yet.
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
            Join communities or follow people to see their posts here.
          </p>
        </>
      ) : (
        <p className="text-sm" style={{ color: "var(--color-text-dim)" }}>
          No posts yet. Check back soon.
        </p>
      )}
    </div>
  );
}

function PageCursorGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const div = ref.current;
    if (!div) return;
    const onMove = (e: MouseEvent) => {
      div.style.setProperty("--mx", `${e.clientX}px`);
      div.style.setProperty("--my", `${e.clientY}px`);
      div.style.opacity = "1";
    };
    const onLeave = () => {
      if (div) div.style.opacity = "0";
    };
    window.addEventListener("mousemove", onMove);
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        opacity: 0,
        transition: "opacity 0.6s ease",
        background:
          "radial-gradient(520px circle at var(--mx, -999px) var(--my, -999px), rgba(245,245,247,0.055), transparent 70%)",
      }}
    />
  );
}

function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <PageCursorGlow />
      <Header user={null} />

      {/* ── Hero — two-column ── */}
      <div className="flex-1 flex items-center overflow-hidden">
        <div
          className="mx-auto w-full flex items-center px-4 md:px-6 py-16 md:py-20 gap-8"
          style={{ maxWidth: "1280px" }}
        >
          {/* Left: copy */}
          <div className="flex flex-col gap-10 flex-1 min-w-0">
            <div>
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6"
                style={{
                  background: "var(--color-bg-elev-2)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-dim)",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: "var(--color-success)" }}
                />
                Early access — building in public
              </div>

              <h1
                className="text-4xl md:text-5xl lg:text-6xl font-display tracking-tight mb-6 leading-[1.08]"
                style={{ color: "var(--color-text)" }}
              >
                Communities for creators
                <br />
                <span style={{ color: "var(--color-text-dim)" }}>who actually run them.</span>
              </h1>

              <p
                className="text-lg leading-relaxed mb-8"
                style={{ color: "var(--color-text-dim)", maxWidth: "480px" }}
              >
                A creator-owned community platform — forum-style discussion, threaded posts, voting,
                and real moderation tools. Built for streamers and the people around them.
              </p>

              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  to="/communities"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold no-underline transition-opacity hover:opacity-80"
                  style={{ background: "var(--color-text)", color: "var(--color-bg)" }}
                >
                  Browse communities
                </Link>
                <Link
                  to="/auth/signup"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium no-underline transition-colors"
                  style={{
                    background: "var(--color-bg-elev-1)",
                    color: "var(--color-text)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  Create account
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" style={{ maxWidth: "600px" }}>
              {[
                {
                  label: "Creator-owned",
                  description: "Streamers run their own community. Not a server admin. An owner.",
                },
                {
                  label: "Discoverable",
                  description: "Forum-style, indexed, identity-bearing. Not ephemeral chat.",
                },
                {
                  label: "Actually moderated",
                  description: "Roles, mod queues, audit logs, and ban tools that actually work.",
                },
              ].map((f) => (
                <div
                  key={f.label}
                  className="rounded-lg p-4"
                  style={{
                    background: "var(--color-bg-elev-1)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <p className="text-sm font-semibold mb-1" style={{ color: "var(--color-text)" }}>
                    {f.label}
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-dim)" }}>
                    {f.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: logo — fills all remaining hero height/width with no box boundary */}
          <div className="hidden lg:flex flex-1 self-stretch relative min-h-0">
            <CoreLogo className="absolute inset-0" />
          </div>
        </div>
      </div>

      <Footer />
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
