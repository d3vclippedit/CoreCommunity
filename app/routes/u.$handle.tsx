import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Link, useFetcher, useLoaderData, useRouteLoaderData } from "@remix-run/react";
import { and, desc, eq, isNull } from "drizzle-orm";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Avatar, Header } from "~/components/layout/Header";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { isFollowing } from "~/lib/follows.server";
import type { loader as rootLoader } from "~/root";
import { communities, communityMemberships, posts, users } from "../../db/schema";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [{ title: "CORE" }];
  const description = `${data.user.displayName}'s profile on CORE.`;
  return [
    { title: `@${data.user.handle} — CORE` },
    { name: "description", content: description },
    { property: "og:title", content: `@${data.user.handle} — CORE` },
    { property: "og:description", content: description },
    { property: "og:type", content: "profile" },
  ];
};

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const db = createDb(env.DB);
  const viewer = await getCurrentUser(request, env);

  const user = await db.query.users.findFirst({
    where: and(eq(users.handle, params.handle ?? ""), isNull(users.deletedAt)),
    columns: {
      id: true,
      handle: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      isVerifiedStreamer: true,
      isPlatformAdmin: true,
      createdAt: true,
      followerCount: true,
      followingCount: true,
    },
  });

  if (!user) throw new Response("User not found", { status: 404 });

  const [recentPosts, joinedCommunities, viewerIsFollowing] = await Promise.all([
    db
      .select({
        id: posts.id,
        title: posts.title,
        score: posts.score,
        commentCount: posts.commentCount,
        createdAt: posts.createdAt,
        communitySlug: communities.slug,
      })
      .from(posts)
      .innerJoin(communities, eq(posts.communityId, communities.id))
      .where(and(eq(posts.authorId, user.id), isNull(posts.removedAt)))
      .orderBy(desc(posts.createdAt))
      .limit(20),
    db
      .select({
        slug: communities.slug,
        name: communities.name,
        role: communityMemberships.role,
      })
      .from(communityMemberships)
      .innerJoin(communities, eq(communityMemberships.communityId, communities.id))
      .where(eq(communityMemberships.userId, user.id))
      .limit(10),
    viewer && viewer.id !== user.id ? isFollowing(db, viewer.id, user.id) : Promise.resolve(false),
  ]);

  return { user, recentPosts, joinedCommunities, viewerId: viewer?.id ?? null, viewerIsFollowing };
}

export default function UserProfile() {
  const { user, recentPosts, joinedCommunities, viewerId, viewerIsFollowing } =
    useLoaderData<typeof loader>();
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const rootUser = root?.user ?? null;
  const followFetcher = useFetcher<{ following?: boolean; error?: string }>();

  const isOwnProfile = viewerId === user.id;
  const optimisticFollowing =
    followFetcher.formData?.get("intent") === "follow"
      ? true
      : followFetcher.formData?.get("intent") === "unfollow"
        ? false
        : viewerIsFollowing;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header user={rootUser} />
      <AppShell
        rightRail={
          <div
            className="rounded-lg p-4"
            style={{
              background: "var(--color-bg-elev-1)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h2
              className="text-xs font-semibold mb-3 uppercase tracking-wide"
              style={{ color: "var(--color-text-faint)" }}
            >
              Communities
            </h2>
            {joinedCommunities.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                No communities yet.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {joinedCommunities.map((c) => (
                  <Link
                    key={c.slug}
                    to={`/c/${c.slug}`}
                    className="flex items-center justify-between text-xs no-underline hover:underline"
                    style={{ color: "var(--color-text-dim)" }}
                  >
                    <span>c/{c.slug}</span>
                    {c.role !== "member" && (
                      <span style={{ color: "var(--color-text-faint)" }} className="capitalize">
                        {c.role}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        }
      >
        <div className="py-6">
          {/* Profile header */}
          <div className="flex items-start gap-4 mb-6">
            <Avatar displayName={user.displayName} avatarUrl={user.avatarUrl} size={64} />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>
                    {user.displayName}
                  </h1>
                  {user.isVerifiedStreamer && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: "var(--color-bg-elev-2)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text-dim)",
                      }}
                    >
                      Verified Streamer
                    </span>
                  )}
                  {user.isPlatformAdmin && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: "var(--color-bg-elev-2)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-danger)",
                      }}
                    >
                      Admin
                    </span>
                  )}
                </div>
                {viewerId && !isOwnProfile && (
                  <followFetcher.Form method="post" action="/api/follow">
                    <input type="hidden" name="targetUserId" value={user.id} />
                    <button
                      type="submit"
                      name="intent"
                      value={optimisticFollowing ? "unfollow" : "follow"}
                      className="px-4 py-1.5 text-sm font-medium rounded-md transition-opacity hover:opacity-80 flex-shrink-0"
                      style={
                        optimisticFollowing
                          ? {
                              background: "var(--color-bg-elev-2)",
                              border: "1px solid var(--color-border)",
                              color: "var(--color-text-dim)",
                            }
                          : { background: "var(--color-text)", color: "var(--color-bg)" }
                      }
                    >
                      {optimisticFollowing ? "Following" : "Follow"}
                    </button>
                  </followFetcher.Form>
                )}
              </div>
              <p className="text-sm mt-0.5" style={{ color: "var(--color-text-faint)" }}>
                @{user.handle}
              </p>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-sm" style={{ color: "var(--color-text-dim)" }}>
                  <strong style={{ color: "var(--color-text)" }}>{user.followerCount}</strong>{" "}
                  follower{user.followerCount !== 1 ? "s" : ""}
                </span>
                <span className="text-sm" style={{ color: "var(--color-text-dim)" }}>
                  <strong style={{ color: "var(--color-text)" }}>{user.followingCount}</strong>{" "}
                  following
                </span>
              </div>
              {user.bio && (
                <p
                  className="text-sm mt-2 leading-relaxed"
                  style={{ color: "var(--color-text-dim)" }}
                >
                  {user.bio}
                </p>
              )}
              <p className="text-xs mt-2" style={{ color: "var(--color-text-faint)" }}>
                Joined{" "}
                {new Date(user.createdAt).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          {/* Recent posts */}
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text)" }}>
            Recent posts
          </h2>
          {recentPosts.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-text-faint)" }}>
              No posts yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {recentPosts.map((post) => (
                <Link
                  key={post.id}
                  to={`/c/${post.communitySlug}/p/${post.id}`}
                  className="rounded-lg p-3 flex items-start gap-3 no-underline hover:opacity-80 transition-opacity"
                  style={{
                    background: "var(--color-bg-elev-1)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <span
                    className="text-xs font-semibold flex-shrink-0 pt-0.5"
                    style={{ color: "var(--color-text-dim)" }}
                  >
                    {post.score}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium leading-snug"
                      style={{ color: "var(--color-text)" }}
                    >
                      {post.title}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--color-text-faint)" }}>
                      c/{post.communitySlug} · {relativeTime(post.createdAt)} · {post.commentCount}{" "}
                      comment{post.commentCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </AppShell>
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
  return `${Math.floor(hrs / 24)}d ago`;
}
