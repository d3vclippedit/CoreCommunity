import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Form, Link, useFetcher, useLoaderData, useRouteLoaderData } from "@remix-run/react";
import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { canFeaturePost, canPinPost } from "~/lib/permissions";
import { checkRateLimit } from "~/lib/ratelimit";
import { generateId } from "~/lib/utils";
import type { loader as rootLoader } from "~/root";
import {
  bans,
  comments,
  communities,
  communityMemberships,
  posts,
  users,
  votes,
} from "../../db/schema";
import { CommunityAvatar } from "./communities._index";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data ? `${data.post.title} — CORE` : "CORE" },
];

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const db = createDb(env.DB);
  const user = await getCurrentUser(request, env);

  const community = await db.query.communities.findFirst({
    where: and(eq(communities.slug, params.slug ?? ""), isNull(communities.deletedAt)),
    columns: { id: true, slug: true, name: true, iconUrl: true },
  });
  if (!community) throw new Response("Community not found", { status: 404 });

  const post = await db.query.posts.findFirst({
    where: and(eq(posts.id, params.postId ?? ""), isNull(posts.removedAt)),
  });
  if (!post || post.communityId !== community.id) {
    throw new Response("Post not found", { status: 404 });
  }

  const author = await db.query.users.findFirst({
    where: eq(users.id, post.authorId),
    columns: { handle: true, displayName: true },
  });

  const topComments = await db
    .select({
      id: comments.id,
      parentCommentId: comments.parentCommentId,
      body: comments.body,
      score: comments.score,
      createdAt: comments.createdAt,
      removedAt: comments.removedAt,
      authorHandle: users.handle,
      authorDisplayName: users.displayName,
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(eq(comments.postId, post.id))
    .orderBy(desc(comments.score))
    .limit(200);

  let userVote: number | null = null;
  let memberRole: string | null = null;
  if (user) {
    const [v, mem] = await Promise.all([
      db.query.votes.findFirst({
        where: and(
          eq(votes.userId, user.id),
          eq(votes.targetType, "post"),
          eq(votes.targetId, post.id),
        ),
        columns: { value: true },
      }),
      db.query.communityMemberships.findFirst({
        where: and(
          eq(communityMemberships.userId, user.id),
          eq(communityMemberships.communityId, community.id),
        ),
        columns: { role: true },
      }),
    ]);
    userVote = v?.value ?? null;
    memberRole = mem?.role ?? null;
  }

  return { community, post, author, comments: topComments, userVote, memberRole };
}

export async function action({ params, request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) return { error: "You must be logged in to comment." };
  if (!user.emailVerifiedAt) return { error: "You must verify your email before commenting." };

  const rl = await checkRateLimit(env.KV, "comment", user.id, 20, 3600);
  if (!rl.allowed) return { error: "Too many comments. Try again later." };

  const form = await request.formData();
  const body = (form.get("body") as string | null)?.trim() ?? "";
  const parentCommentId = (form.get("parentCommentId") as string | null) || null;

  if (!body || body.length < 1) return { error: "Comment cannot be empty." };
  if (body.length > 10000) return { error: "Comment is too long." };

  const db = createDb(env.DB);
  const post = await db.query.posts.findFirst({
    where: and(eq(posts.id, params.postId ?? ""), isNull(posts.removedAt)),
    columns: { id: true, communityId: true },
  });
  if (!post) throw new Response("Post not found", { status: 404 });

  // Check for active ban or timeout
  const activeBan = await db.query.bans.findFirst({
    where: and(
      eq(bans.communityId, post.communityId),
      eq(bans.userId, user.id),
      or(isNull(bans.expiresAt), gt(bans.expiresAt, new Date())),
    ),
    columns: { type: true, expiresAt: true },
  });
  if (activeBan) {
    const msg =
      activeBan.type === "ban"
        ? "You are banned from this community."
        : `You are timed out${activeBan.expiresAt ? ` until ${activeBan.expiresAt.toLocaleString()}` : ""}.`;
    return { error: msg };
  }

  const now = new Date();
  await db.insert(comments).values({
    id: generateId(),
    postId: post.id,
    parentCommentId,
    authorId: user.id,
    body,
    score: 0,
    upvotes: 0,
    downvotes: 0,
    createdAt: now,
    updatedAt: now,
  });

  await db
    .update(posts)
    .set({ commentCount: sql`${posts.commentCount} + 1`, updatedAt: now })
    .where(eq(posts.id, post.id));

  return { ok: true };
}

export default function PostPermalink() {
  const {
    community,
    post,
    author,
    comments: allComments,
    userVote,
    memberRole,
  } = useLoaderData<typeof loader>();
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const rootUser = root?.user ?? null;
  const commentFetcher = useFetcher<typeof action>();
  const modFetcher = useFetcher();
  const isAdmin = rootUser?.isPlatformAdmin ?? false;
  const canPin = canPinPost(memberRole as Parameters<typeof canPinPost>[0]) || isAdmin;
  const canFeature = canFeaturePost(memberRole as Parameters<typeof canFeaturePost>[0]) || isAdmin;

  const topLevel = allComments.filter((c) => !c.parentCommentId);
  const byParent: Record<string, typeof allComments> = {};
  for (const c of allComments) {
    if (c.parentCommentId) {
      if (!byParent[c.parentCommentId]) byParent[c.parentCommentId] = [];
      byParent[c.parentCommentId].push(c);
    }
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header user={rootUser} />
      <AppShell>
        <div className="py-4">
          {/* Breadcrumb */}
          <div
            className="flex items-center gap-2 mb-4 text-xs"
            style={{ color: "var(--color-text-faint)" }}
          >
            <CommunityAvatar name={community.name} iconUrl={community.iconUrl} size={16} />
            <Link
              to={`/c/${community.slug}`}
              className="no-underline hover:underline font-medium"
              style={{ color: "var(--color-text-dim)" }}
            >
              c/{community.slug}
            </Link>
          </div>

          {/* Post */}
          <div
            className="rounded-lg p-5 mb-4"
            style={{
              background: "var(--color-bg-elev-1)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div className="flex gap-3">
              {/* Voting */}
              <VoteWidget
                targetType="post"
                targetId={post.id}
                score={post.score}
                userVote={userVote}
                user={rootUser}
              />

              <div className="flex-1 min-w-0">
                <h1
                  className="text-lg font-semibold leading-snug mb-2"
                  style={{ color: "var(--color-text)" }}
                >
                  {post.title}
                </h1>
                {post.body && (
                  <p
                    className="text-sm leading-relaxed mb-3 whitespace-pre-wrap"
                    style={{ color: "var(--color-text-dim)" }}
                  >
                    {post.body}
                  </p>
                )}
                <div
                  className="flex items-center gap-3 text-xs flex-wrap"
                  style={{ color: "var(--color-text-faint)" }}
                >
                  <span>
                    by{" "}
                    <Link
                      to={`/u/${author?.handle}`}
                      className="no-underline hover:underline"
                      style={{ color: "var(--color-text-dim)" }}
                    >
                      {author?.handle}
                    </Link>
                  </span>
                  <span>{relativeTime(post.createdAt)}</span>
                  <span>{post.commentCount} comments</span>
                  {post.isPinned && (
                    <span style={{ color: "var(--color-success)" }}>📌 Pinned</span>
                  )}
                  {post.isFeatured && (
                    <span style={{ color: "var(--color-text-dim)" }}>★ Featured</span>
                  )}
                </div>

                {/* Mod actions */}
                {(canPin || canFeature) && (
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {canPin && (
                      <modFetcher.Form method="post" action="/api/mod">
                        <input
                          type="hidden"
                          name="action"
                          value={post.isPinned ? "unpin" : "pin"}
                        />
                        <input type="hidden" name="postId" value={post.id} />
                        <input type="hidden" name="communitySlug" value={community.slug} />
                        <button
                          type="submit"
                          className="text-xs px-2 py-1 rounded"
                          style={{
                            border: "1px solid var(--color-border)",
                            color: "var(--color-text-faint)",
                          }}
                        >
                          {post.isPinned ? "Unpin" : "Pin"}
                        </button>
                      </modFetcher.Form>
                    )}
                    {canFeature && (
                      <modFetcher.Form method="post" action="/api/mod">
                        <input
                          type="hidden"
                          name="action"
                          value={post.isFeatured ? "unfeature" : "feature"}
                        />
                        <input type="hidden" name="postId" value={post.id} />
                        <input type="hidden" name="communitySlug" value={community.slug} />
                        <button
                          type="submit"
                          className="text-xs px-2 py-1 rounded"
                          style={{
                            border: "1px solid var(--color-border)",
                            color: "var(--color-text-faint)",
                          }}
                        >
                          {post.isFeatured ? "Unfeature" : "Feature"}
                        </button>
                      </modFetcher.Form>
                    )}
                    <Form method="post" action="/api/remove">
                      <input type="hidden" name="targetType" value="post" />
                      <input type="hidden" name="targetId" value={post.id} />
                      <input type="hidden" name="communitySlug" value={community.slug} />
                      <input type="hidden" name="redirectTo" value={`/c/${community.slug}`} />
                      <button
                        type="submit"
                        className="text-xs px-2 py-1 rounded"
                        style={{
                          border: "1px solid var(--color-danger)",
                          color: "var(--color-danger)",
                        }}
                      >
                        Remove post
                      </button>
                    </Form>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Comment form */}
          {rootUser ? (
            <div
              className="rounded-lg p-4 mb-4"
              style={{
                background: "var(--color-bg-elev-1)",
                border: "1px solid var(--color-border)",
              }}
            >
              {commentFetcher.data &&
                "error" in commentFetcher.data &&
                commentFetcher.data.error && (
                  <p className="text-xs mb-2" style={{ color: "var(--color-danger)" }}>
                    {commentFetcher.data.error}
                  </p>
                )}
              <commentFetcher.Form method="post" className="flex flex-col gap-2">
                <textarea
                  name="body"
                  placeholder="Write a comment…"
                  rows={3}
                  required
                  className="w-full rounded-md px-3 py-2 text-sm resize-y"
                  style={{
                    background: "var(--color-bg-elev-2)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                    outline: "none",
                    minHeight: "80px",
                  }}
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={commentFetcher.state !== "idle"}
                    className="px-3 py-1.5 text-xs font-medium rounded-md disabled:opacity-60"
                    style={{ background: "var(--color-text)", color: "var(--color-bg)" }}
                  >
                    {commentFetcher.state !== "idle" ? "Posting…" : "Comment"}
                  </button>
                </div>
              </commentFetcher.Form>
            </div>
          ) : (
            <div className="mb-4 text-sm" style={{ color: "var(--color-text-dim)" }}>
              <Link to="/auth/login" className="underline" style={{ color: "var(--color-text)" }}>
                Log in
              </Link>{" "}
              to join the discussion.
            </div>
          )}

          {/* Comments */}
          <div className="flex flex-col gap-3">
            {topLevel.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--color-text-faint)" }}>
                No comments yet. Be the first!
              </p>
            ) : (
              topLevel.map((c) => (
                <CommentThread
                  key={c.id}
                  comment={c}
                  replies={byParent[c.id] ?? []}
                  nestedReplies={byParent}
                  user={rootUser}
                  depth={0}
                />
              ))
            )}
          </div>
        </div>
      </AppShell>
      <Footer />
    </div>
  );
}

type CommentData = {
  id: string;
  parentCommentId: string | null;
  body: string;
  score: number;
  createdAt: string;
  removedAt: string | null;
  authorHandle: string;
  authorDisplayName: string;
};

function CommentThread({
  comment,
  replies,
  nestedReplies,
  user,
  depth,
}: {
  comment: CommentData;
  replies: CommentData[];
  nestedReplies: Record<string, CommentData[]>;
  user: { id: string } | null;
  depth: number;
}) {
  return (
    <div
      className={depth > 0 ? "pl-4 border-l" : ""}
      style={depth > 0 ? { borderColor: "var(--color-border)" } : undefined}
    >
      <div className="flex gap-2 py-2">
        <div className="flex-1 min-w-0">
          {comment.removedAt ? (
            <p className="text-sm italic" style={{ color: "var(--color-text-faint)" }}>
              [removed]
            </p>
          ) : (
            <>
              <div
                className="flex items-center gap-2 mb-1 text-xs"
                style={{ color: "var(--color-text-faint)" }}
              >
                <Link
                  to={`/u/${comment.authorHandle}`}
                  className="font-medium no-underline hover:underline"
                  style={{ color: "var(--color-text-dim)" }}
                >
                  {comment.authorHandle}
                </Link>
                <span>{relativeTime(comment.createdAt)}</span>
                <span>▲ {comment.score}</span>
              </div>
              <p
                className="text-sm leading-relaxed whitespace-pre-wrap"
                style={{ color: "var(--color-text)" }}
              >
                {comment.body}
              </p>
            </>
          )}
        </div>
      </div>
      {depth < 3 &&
        replies.map((r) => (
          <CommentThread
            key={r.id}
            comment={r}
            replies={nestedReplies[r.id] ?? []}
            nestedReplies={nestedReplies}
            user={user}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

function VoteWidget({
  targetType,
  targetId,
  score,
  userVote,
  user,
}: {
  targetType: "post" | "comment";
  targetId: string;
  score: number;
  userVote: number | null;
  user: { id: string } | null;
}) {
  const fetcher = useFetcher();

  return (
    <div className="flex flex-col items-center gap-1 flex-shrink-0 w-8">
      <fetcher.Form method="post" action="/api/vote">
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="value" value={userVote === 1 ? "0" : "1"} />
        <button
          type="submit"
          disabled={!user}
          aria-label="Upvote"
          className="w-6 h-6 flex items-center justify-center rounded text-xs disabled:opacity-40"
          style={{
            color: userVote === 1 ? "var(--color-text)" : "var(--color-text-faint)",
            background: userVote === 1 ? "var(--color-bg-elev-2)" : undefined,
          }}
        >
          ▲
        </button>
      </fetcher.Form>
      <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
        {score}
      </span>
      <fetcher.Form method="post" action="/api/vote">
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="value" value={userVote === -1 ? "0" : "-1"} />
        <button
          type="submit"
          disabled={!user}
          aria-label="Downvote"
          className="w-6 h-6 flex items-center justify-center rounded text-xs disabled:opacity-40"
          style={{
            color: userVote === -1 ? "var(--color-danger)" : "var(--color-text-faint)",
            background: userVote === -1 ? "var(--color-bg-elev-2)" : undefined,
          }}
        >
          ▼
        </button>
      </fetcher.Form>
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
