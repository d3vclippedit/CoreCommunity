import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Link, useLoaderData, useSearchParams } from "@remix-run/react";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { CoreLogoDebug } from "~/components/CoreLogo";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { communities, communityMemberships, posts, users } from "../../db/schema";
import { CommunityAvatar } from "./communities._index";

export const meta: MetaFunction = () => [
  { title: "CORE — Communities for creators who actually run them" },
  {
    name: "description",
    content:
      "CORE is a creator-owned community platform — forum-style discussion, threaded posts, voting, and real moderation tools. Built for streamers and the people around them.",
  },
  { property: "og:title", content: "CORE" },
  { property: "og:description", content: "Communities for creators who actually run them." },
  { property: "og:type", content: "website" },
];

type Tab = "all" | "mine" | "discover";
type Sort = "hot" | "new" | "top";

type FeedPost = {
  id: string;
  title: string;
  type: string;
  url: string | null;
  score: number;
  commentCount: number;
  isPinned: boolean;
  createdAt: string;
  authorHandle: string | null;
  communitySlug: string | null;
  communityName: string | null;
  communityIconUrl: string | null;
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

  // All or Mine — fetch posts
  const orderBy = sort === "new" ? desc(posts.createdAt) : desc(posts.score);

  if (tab === "mine" && joinedIds.length === 0) {
    return {
      user,
      tab,
      sort,
      posts: [] as FeedPost[],
      discoverCommunities: [] as DiscoverCommunity[],
      joinedSlugs: [] as string[],
    };
  }

  const whereClause =
    tab === "mine"
      ? and(isNull(posts.removedAt), inArray(posts.communityId, joinedIds))
      : isNull(posts.removedAt);

  const feedPosts = await db
    .select({
      id: posts.id,
      title: posts.title,
      type: posts.type,
      url: posts.url,
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
    .limit(50);

  return {
    user,
    tab,
    sort,
    posts: feedPosts,
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
    setSearchParams(s === "hot" ? (tab === "all" ? {} : { tab }) : { tab, sort: s });

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
            {(["all", "mine", "discover"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className="flex-1 py-1.5 text-sm font-medium rounded-md transition-colors capitalize"
                style={
                  tab === t
                    ? { background: "var(--color-bg-elev-2)", color: "var(--color-text)" }
                    : { color: "var(--color-text-faint)" }
                }
              >
                {t === "all" ? "All Posts" : t === "mine" ? "Your Feed" : "Discover"}
              </button>
            ))}
          </div>

          {/* Sort controls (only for post tabs) */}
          {tab !== "discover" && (
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

function FeedPostCard({ post }: { post: FeedPost }) {
  return (
    <div
      className="rounded-lg p-4 flex gap-3 transition-colors hover:border-[--color-border]"
      style={{
        background: "var(--color-bg-elev-1)",
        border: "1px solid var(--color-border)",
      }}
    >
      {/* Score */}
      <div className="flex flex-col items-center gap-0.5 flex-shrink-0 w-8 text-center pt-0.5">
        <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          {post.score}
        </span>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Community badge */}
        <Link
          to={`/c/${post.communitySlug}`}
          className="inline-flex items-center gap-1.5 mb-1.5 no-underline group"
          onClick={(e) => e.stopPropagation()}
        >
          <CommunityAvatar
            name={post.communityName ?? ""}
            iconUrl={post.communityIconUrl}
            size={16}
          />
          <span
            className="text-xs font-medium group-hover:underline"
            style={{ color: "var(--color-text-dim)" }}
          >
            c/{post.communitySlug}
          </span>
        </Link>

        {/* Title */}
        <div className="flex items-start gap-2">
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
          >
            {post.title}
          </Link>
          {post.type === "link" && post.url && (
            <span
              className="text-xs flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded"
              style={{
                background: "var(--color-bg-elev-2)",
                color: "var(--color-text-faint)",
              }}
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
        </div>

        {/* Meta */}
        <div
          className="flex items-center gap-3 mt-1.5 text-xs flex-wrap"
          style={{ color: "var(--color-text-faint)" }}
        >
          <span>by {post.authorHandle}</span>
          <span>{relativeTime(post.createdAt)}</span>
          <Link
            to={`/c/${post.communitySlug}/p/${post.id}`}
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
      {tab === "mine" ? (
        <>
          <p className="text-sm mb-3" style={{ color: "var(--color-text-dim)" }}>
            Your feed is empty. Join some communities to see their posts here.
          </p>
          <Link
            to="/communities"
            className="text-sm font-medium no-underline hover:underline"
            style={{ color: "var(--color-text)" }}
          >
            Browse communities →
          </Link>
        </>
      ) : (
        <p className="text-sm" style={{ color: "var(--color-text-dim)" }}>
          No posts yet. Check back soon.
        </p>
      )}
    </div>
  );
}

function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
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

          {/* Right: interactive network */}
          <div
            className="hidden lg:flex flex-shrink-0 items-center justify-center"
            style={{ width: "46%", maxWidth: "660px" }}
          >
            <CoreLogoDebug className="w-full" style={{ height: "min(580px, 70vh)" }} />
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
