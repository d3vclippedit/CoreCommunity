import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Form, Link, useFetcher, useLoaderData, useRouteLoaderData } from "@remix-run/react";
import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { useState } from "react";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { getCurrentUser } from "~/lib/auth/user.server";
import { getActiveBadgeDefinitions, getPostBadgeSummary } from "~/lib/badges.server";
import { getBalance } from "~/lib/coins.server";
import { createDb } from "~/lib/db/index";
import { getEmbedSrc } from "~/lib/embeds";
import { type OgPreview, getOgPreview } from "~/lib/og.server";
import { canFeaturePost, canPinPost } from "~/lib/permissions";
import { checkRateLimit } from "~/lib/ratelimit";
import { sanitizeHtml } from "~/lib/sanitize";
import { generateId } from "~/lib/utils";
import type { loader as rootLoader } from "~/root";
import {
  bans,
  comments,
  communities,
  communityMemberships,
  giveawayEntries,
  giveaways,
  pollOptions,
  pollVotes,
  polls,
  posts,
  users,
  votes,
} from "../../db/schema";
import { CommunityAvatar } from "./communities._index";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [{ title: "Cormunities" }];
  const description = data.post.body
    ? data.post.body.replace(/<[^>]+>/g, "").slice(0, 160)
    : `Discussion in c/${data.community.slug} on CORE`;
  return [
    { title: `${data.post.title} — CORE` },
    { name: "description", content: description },
    { property: "og:title", content: data.post.title },
    { property: "og:description", content: description },
    { property: "og:type", content: "article" },
  ];
};

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

  const host = new URL(request.url).hostname;

  let ogPreview = null;
  if (post.type === "link" && post.url && !post.embedKind) {
    ogPreview = await getOgPreview(post.url, env.KV);
  }

  const [badgeSummary, badgeDefs, userCoinBalance] = await Promise.all([
    getPostBadgeSummary(db, post.id),
    getActiveBadgeDefinitions(db),
    user ? getBalance(db, user.id) : Promise.resolve(0),
  ]);

  let pollData: {
    id: string;
    endsAt: Date | null;
    isClosed: boolean;
    options: { id: string; text: string; position: number; voteCount: number }[];
    userVoteOptionId: string | null;
    totalVotes: number;
    isEnded: boolean;
  } | null = null;

  if (post.type === "poll") {
    const poll = await db.query.polls.findFirst({
      where: eq(polls.postId, post.id),
      columns: { id: true, endsAt: true, isClosed: true },
    });
    if (poll) {
      const options = await db.query.pollOptions.findMany({
        where: eq(pollOptions.pollId, poll.id),
        orderBy: (o, { asc }) => [asc(o.position)],
      });
      let userVoteOptionId: string | null = null;
      if (user) {
        const pv = await db.query.pollVotes.findFirst({
          where: and(eq(pollVotes.userId, user.id), eq(pollVotes.pollId, poll.id)),
          columns: { optionId: true },
        });
        userVoteOptionId = pv?.optionId ?? null;
      }
      const totalVotes = options.reduce((s, o) => s + o.voteCount, 0);
      const isEnded = poll.isClosed || (poll.endsAt ? poll.endsAt < new Date() : false);
      pollData = {
        id: poll.id,
        endsAt: poll.endsAt,
        isClosed: poll.isClosed,
        options,
        userVoteOptionId,
        totalVotes,
        isEnded,
      };
    }
  }

  let giveawayData: {
    id: string;
    prize: string;
    description: string | null;
    status: string;
    endsAt: Date | null;
    minMembershipDays: number | null;
    minPostCount: number | null;
    winnerUserId: string | null;
    winnerHandle: string | null;
    hasEntered: boolean;
    isMod: boolean;
  } | null = null;

  if (post.type === "giveaway") {
    const giveaway = await db.query.giveaways.findFirst({
      where: eq(giveaways.postId, post.id),
    });
    if (giveaway) {
      let hasEntered = false;
      if (user) {
        const entry = await db.query.giveawayEntries.findFirst({
          where: and(
            eq(giveawayEntries.giveawayId, giveaway.id),
            eq(giveawayEntries.userId, user.id),
          ),
          columns: { id: true },
        });
        hasEntered = !!entry;
      }
      const modCheck =
        memberRole === "mod" ||
        memberRole === "senior_mod" ||
        memberRole === "admin" ||
        memberRole === "streamer";
      let winnerHandle: string | null = null;
      if (giveaway.winnerUserId) {
        const wu = await db.query.users.findFirst({
          where: eq(users.id, giveaway.winnerUserId),
          columns: { handle: true },
        });
        winnerHandle = wu?.handle ?? null;
      }
      giveawayData = {
        id: giveaway.id,
        prize: giveaway.prize,
        description: giveaway.description,
        status: giveaway.status,
        endsAt: giveaway.endsAt,
        minMembershipDays: giveaway.minMembershipDays,
        minPostCount: giveaway.minPostCount,
        winnerUserId: giveaway.winnerUserId,
        winnerHandle,
        hasEntered,
        isMod: modCheck,
      };
    }
  }

  // Increment view count — non-critical, silently ignore failures
  try {
    await db
      .update(posts)
      .set({ viewCount: sql`${posts.viewCount} + 1` })
      .where(eq(posts.id, post.id));
  } catch {}

  const isPostAuthor = user?.id === post.authorId;

  return {
    community,
    post,
    author,
    comments: topComments,
    userVote,
    memberRole,
    host,
    ogPreview,
    badgeSummary,
    badgeDefs,
    userCoinBalance,
    isPostAuthor,
    pollData,
    giveawayData,
  };
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
    host,
    ogPreview,
    badgeSummary,
    badgeDefs,
    userCoinBalance,
    pollData,
    giveawayData,
  } = useLoaderData<typeof loader>();
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const rootUser = root?.user ?? null;
  const commentFetcher = useFetcher<typeof action>();
  const modFetcher = useFetcher();
  const badgeFetcher = useFetcher<{ success?: boolean; newBalance?: number; error?: string }>();
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
                {post.type === "link" && post.url && (
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs mb-2 block truncate no-underline hover:underline"
                    style={{ color: "var(--color-text-faint)" }}
                  >
                    {new URL(post.url).hostname}
                  </a>
                )}
                {post.type === "image" && post.url && (
                  <div className="mb-3 rounded-md overflow-hidden">
                    <img
                      src={post.url}
                      alt={post.title}
                      className="max-w-full rounded-md"
                      style={{ maxHeight: "600px", objectFit: "contain", display: "block" }}
                    />
                  </div>
                )}
                {post.type === "video" && post.url && (
                  <div className="mb-3 rounded-md overflow-hidden">
                    {/* biome-ignore lint/a11y/useMediaCaption: user-uploaded clips, no caption track available */}
                    <video
                      src={post.url}
                      controls
                      className="w-full rounded-md"
                      style={{ maxHeight: "540px", display: "block" }}
                    />
                  </div>
                )}
                {post.type === "link" && post.url && !post.embedKind && ogPreview && (
                  <OgPreviewCard preview={ogPreview} url={post.url} />
                )}
                {post.embedKind && post.embedRef && (
                  <div className="mb-3 rounded-md overflow-hidden" style={{ aspectRatio: "16/9" }}>
                    <iframe
                      src={getEmbedSrc(post.embedKind, post.embedRef, host)}
                      title="Embedded video"
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      className="w-full h-full"
                      style={{ border: "none" }}
                    />
                  </div>
                )}
                {post.body && (
                  <div
                    className="prose-body mb-3"
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized server-side
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.body) }}
                  />
                )}
                {pollData && <PollWidget pollData={pollData} userId={rootUser?.id ?? null} />}
                {giveawayData && <GiveawayWidget giveaway={giveawayData} isLoggedIn={!!rootUser} />}
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
                  {rootUser && rootUser.id !== post.authorId && (
                    <ReportPostButton postId={post.id} communityId={community.id} />
                  )}
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

            {/* Badge row */}
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--color-border)" }}>
              {badgeSummary.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {badgeSummary.map((b) => (
                    <span
                      key={b.badgeDefinitionId}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{
                        background: "var(--color-bg-elev-2)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text-dim)",
                      }}
                      title={`${b.name}: ${b.count} × ${b.coinCost} cc`}
                    >
                      <span>{b.icon}</span>
                      <span>{b.name}</span>
                      {b.count > 1 && (
                        <span style={{ color: "var(--color-text-faint)" }}>×{b.count}</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
              {rootUser && badgeDefs.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium" style={{ color: "var(--color-text-faint)" }}>
                      Give a badge
                    </p>
                    <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                      Balance:{" "}
                      <span style={{ color: "var(--color-text-dim)" }}>
                        {userCoinBalance.toLocaleString()} cc
                      </span>
                    </p>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                    {badgeDefs.map((def) => {
                      const canAfford = userCoinBalance >= def.coinCost;
                      return (
                        <form
                          key={def.id}
                          method="post"
                          action="/api/badges/apply"
                          onSubmit={(e) => {
                            e.preventDefault();
                            badgeFetcher.submit(e.currentTarget);
                          }}
                        >
                          <input type="hidden" name="postId" value={post.id} />
                          <input type="hidden" name="badgeDefinitionId" value={def.id} />
                          <button
                            type="submit"
                            disabled={!canAfford || badgeFetcher.state !== "idle"}
                            className="w-full rounded-lg p-2 flex flex-col items-center gap-0.5 transition-opacity hover:opacity-80 disabled:opacity-40"
                            style={{
                              background: "var(--color-bg-elev-2)",
                              border: "1px solid var(--color-border)",
                            }}
                            title={canAfford ? `${def.coinCost} cc` : "Not enough coins"}
                          >
                            <span className="text-lg">{def.icon}</span>
                            <span
                              className="text-[10px] leading-tight font-medium"
                              style={{ color: "var(--color-text-faint)" }}
                            >
                              {def.coinCost >= 1000 ? `${def.coinCost / 1000}k` : def.coinCost}
                            </span>
                          </button>
                        </form>
                      );
                    })}
                  </div>
                  {badgeFetcher.data?.error && (
                    <p className="text-xs mt-2" style={{ color: "var(--color-danger)" }}>
                      {badgeFetcher.data.error}
                    </p>
                  )}
                  {badgeFetcher.data?.success && (
                    <p className="text-xs mt-2" style={{ color: "var(--color-success)" }}>
                      Badge given! Balance: {badgeFetcher.data.newBalance?.toLocaleString()} cc
                    </p>
                  )}
                  {userCoinBalance === 0 && (
                    <p className="text-xs mt-1.5" style={{ color: "var(--color-text-faint)" }}>
                      <a href="/coins" style={{ color: "var(--color-text-dim)" }}>
                        Buy coins
                      </a>{" "}
                      to give badges.
                    </p>
                  )}
                </div>
              )}
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

function OgPreviewCard({ preview, url }: { preview: OgPreview; url: string }) {
  const hasContent = preview.title || preview.description || preview.image;
  if (!hasContent) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mb-3 rounded-md overflow-hidden flex no-underline block"
      style={{
        background: "var(--color-bg-elev-2)",
        border: "1px solid var(--color-border)",
      }}
    >
      {preview.image && (
        <img
          src={preview.image}
          alt=""
          aria-hidden="true"
          className="object-cover flex-shrink-0"
          style={{ width: "120px", height: "80px" }}
        />
      )}
      <div className="flex flex-col justify-center px-3 py-2 min-w-0">
        {preview.title && (
          <p
            className="text-xs font-semibold leading-snug line-clamp-2"
            style={{ color: "var(--color-text)" }}
          >
            {preview.title}
          </p>
        )}
        {preview.description && (
          <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--color-text-dim)" }}>
            {preview.description}
          </p>
        )}
      </div>
    </a>
  );
}

function ReportPostButton({
  postId,
  communityId,
}: {
  postId: string;
  communityId: string;
}) {
  const [open, setOpen] = useState(false);
  const fetcher = useFetcher<{ ok?: boolean; error?: string }>();
  const done = fetcher.data?.ok;

  if (done) {
    return (
      <span className="text-xs" style={{ color: "var(--color-text-faint)" }}>
        Reported
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs hover:underline"
        style={{
          color: "var(--color-text-faint)",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        Report
      </button>
    );
  }

  return (
    <fetcher.Form
      method="post"
      action="/api/report"
      className="flex items-center gap-1.5"
      onSubmit={() => setOpen(false)}
    >
      <input type="hidden" name="targetType" value="post" />
      <input type="hidden" name="targetId" value={postId} />
      <input type="hidden" name="communityId" value={communityId} />
      <select
        name="reason"
        required
        className="rounded px-1.5 py-0.5 text-xs"
        style={{
          background: "var(--color-bg-elev-2)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text-dim)",
        }}
      >
        <option value="">Reason…</option>
        <option value="spam">Spam</option>
        <option value="harassment">Harassment</option>
        <option value="nsfw">NSFW</option>
        <option value="off_topic">Off topic</option>
        <option value="other">Other</option>
      </select>
      <button
        type="submit"
        className="text-xs px-2 py-0.5 rounded"
        style={{
          background: "var(--color-danger)",
          color: "#fff",
          border: "none",
          cursor: "pointer",
        }}
      >
        Send
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs"
        style={{
          color: "var(--color-text-faint)",
          background: "none",
          border: "none",
          cursor: "pointer",
        }}
      >
        ✕
      </button>
    </fetcher.Form>
  );
}

function PollWidget({
  pollData,
  userId,
}: {
  pollData: {
    id: string;
    endsAt: Date | string | null;
    isClosed: boolean;
    options: { id: string; text: string; voteCount: number }[];
    userVoteOptionId: string | null;
    totalVotes: number;
    isEnded: boolean;
  };
  userId: string | null;
}) {
  const fetcher = useFetcher<{ ok?: boolean; error?: string }>();
  const votedId = fetcher.data?.ok
    ? (fetcher.formData?.get("optionId") as string | null)
    : pollData.userVoteOptionId;
  const hasVoted = !!votedId;
  const showResults = hasVoted || pollData.isEnded;

  const optimisticOptions = pollData.options.map((o) => ({
    ...o,
    voteCount:
      fetcher.data?.ok && fetcher.formData?.get("optionId") === o.id
        ? o.voteCount + 1
        : o.voteCount,
  }));
  const totalVotes = showResults
    ? optimisticOptions.reduce((s, o) => s + o.voteCount, 0)
    : pollData.totalVotes;

  return (
    <div
      className="rounded-md p-4 mb-3 flex flex-col gap-2"
      style={{ background: "var(--color-bg-elev-2)", border: "1px solid var(--color-border)" }}
    >
      {pollData.isEnded && (
        <p className="text-xs mb-1" style={{ color: "var(--color-text-faint)" }}>
          Poll ended
        </p>
      )}
      {pollData.endsAt && !pollData.isEnded && (
        <p className="text-xs mb-1" style={{ color: "var(--color-text-faint)" }}>
          Ends {new Date(pollData.endsAt).toLocaleDateString()}
        </p>
      )}
      {optimisticOptions.map((opt) => {
        const pct = totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 100) : 0;
        const isWinner =
          pollData.isEnded &&
          opt.voteCount === Math.max(...optimisticOptions.map((o) => o.voteCount));
        return (
          <div key={opt.id} className="flex flex-col gap-1">
            {showResults ? (
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-sm"
                    style={{
                      color: isWinner ? "var(--color-text)" : "var(--color-text-dim)",
                      fontWeight: isWinner ? 600 : undefined,
                    }}
                  >
                    {opt.text}
                    {votedId === opt.id && " ✓"}
                  </span>
                  <span
                    className="text-xs flex-shrink-0"
                    style={{ color: "var(--color-text-faint)" }}
                  >
                    {pct}%
                  </span>
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: "var(--color-bg-elev-1)" }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: isWinner ? "var(--color-text)" : "var(--color-text-faint)",
                    }}
                  />
                </div>
              </div>
            ) : userId ? (
              <fetcher.Form method="post" action="/api/polls">
                <input type="hidden" name="intent" value="vote" />
                <input type="hidden" name="pollId" value={pollData.id} />
                <input type="hidden" name="optionId" value={opt.id} />
                <button
                  type="submit"
                  disabled={fetcher.state !== "idle"}
                  className="w-full text-left px-3 py-2 rounded-md text-sm transition-colors"
                  style={{
                    background: "var(--color-bg-elev-1)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-dim)",
                    cursor: "pointer",
                  }}
                >
                  {opt.text}
                </button>
              </fetcher.Form>
            ) : (
              <div
                className="px-3 py-2 rounded-md text-sm"
                style={{
                  background: "var(--color-bg-elev-1)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-faint)",
                }}
              >
                {opt.text}
              </div>
            )}
          </div>
        );
      })}
      <p className="text-xs mt-1" style={{ color: "var(--color-text-faint)" }}>
        {totalVotes.toLocaleString()} vote{totalVotes !== 1 ? "s" : ""}
        {!userId && !pollData.isEnded && " · Log in to vote"}
      </p>
      {fetcher.data && "error" in fetcher.data && fetcher.data.error && (
        <p className="text-xs" style={{ color: "var(--color-danger)" }}>
          {fetcher.data.error}
        </p>
      )}
    </div>
  );
}

function GiveawayWidget({
  giveaway,
  isLoggedIn,
}: {
  giveaway: {
    id: string;
    prize: string;
    description: string | null;
    status: string;
    endsAt: Date | string | null;
    minMembershipDays: number | null;
    minPostCount: number | null;
    winnerUserId: string | null;
    winnerHandle: string | null;
    hasEntered: boolean;
    isMod: boolean;
  };
  isLoggedIn: boolean;
}) {
  const fetcher = useFetcher<{
    ok?: boolean;
    error?: string;
    winnerId?: string;
    winnerHandle?: string | null;
  }>();
  const isActive = giveaway.status === "active";
  const isEnded = giveaway.status === "ended";

  const enteredNow = fetcher.data?.ok && !fetcher.data.winnerId;
  const drawnNow = !!fetcher.data?.winnerId;
  const showError = fetcher.data && "error" in fetcher.data ? fetcher.data.error : null;

  const winnerDisplay = drawnNow
    ? fetcher.data?.winnerHandle
    : isEnded
      ? giveaway.winnerHandle
      : null;

  const requirements: string[] = [];
  if (giveaway.minMembershipDays)
    requirements.push(`Member for ${giveaway.minMembershipDays}+ day(s)`);
  if (giveaway.minPostCount) requirements.push(`${giveaway.minPostCount}+ post(s) in community`);

  const statusColor = isActive
    ? "var(--color-success)"
    : isEnded
      ? "var(--color-text-faint)"
      : "var(--color-danger)";

  return (
    <div
      className="rounded-md p-4 mb-3 flex flex-col gap-2"
      style={{ background: "var(--color-bg-elev-2)", border: "1px solid var(--color-border)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          Prize: {giveaway.prize}
        </p>
        <span
          className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ border: `1px solid ${statusColor}40`, color: statusColor }}
        >
          {isActive ? "Active" : isEnded ? "Ended" : "Cancelled"}
        </span>
      </div>

      {giveaway.description && (
        <p className="text-xs" style={{ color: "var(--color-text-dim)" }}>
          {giveaway.description}
        </p>
      )}

      {requirements.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {requirements.map((r) => (
            <span
              key={r}
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: "var(--color-bg-elev-1)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-faint)",
              }}
            >
              {r}
            </span>
          ))}
        </div>
      )}

      {giveaway.endsAt && (
        <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
          Ends: {new Date(giveaway.endsAt).toLocaleDateString()}
        </p>
      )}

      {showError && (
        <p className="text-xs" style={{ color: "var(--color-danger)" }}>
          {showError}
        </p>
      )}

      {(isEnded && giveaway.winnerUserId) || drawnNow ? (
        <p className="text-sm font-semibold" style={{ color: "var(--color-success)" }}>
          {winnerDisplay ? `🎉 @${winnerDisplay} won the giveaway!` : "🎉 A winner has been drawn!"}
        </p>
      ) : null}

      <div className="flex gap-2 mt-1">
        {isActive && isLoggedIn && !giveaway.hasEntered && !enteredNow && (
          <fetcher.Form method="post" action="/api/giveaway">
            <input type="hidden" name="intent" value="enter" />
            <input type="hidden" name="giveawayId" value={giveaway.id} />
            <button
              type="submit"
              disabled={fetcher.state !== "idle"}
              className="px-3 py-1.5 text-xs font-medium rounded-md"
              style={{
                background: "var(--color-text)",
                color: "var(--color-bg)",
                border: "none",
                cursor: "pointer",
              }}
            >
              {fetcher.state !== "idle" ? "Entering…" : "Enter giveaway"}
            </button>
          </fetcher.Form>
        )}
        {(giveaway.hasEntered || enteredNow) && isActive && (
          <span
            className="text-xs px-3 py-1.5 rounded-md"
            style={{ color: "var(--color-success)", background: "var(--color-bg-elev-1)" }}
          >
            Entered ✓
          </span>
        )}
        {giveaway.isMod && isActive && !drawnNow && (
          <fetcher.Form method="post" action="/api/giveaway">
            <input type="hidden" name="intent" value="draw" />
            <input type="hidden" name="giveawayId" value={giveaway.id} />
            <button
              type="submit"
              disabled={fetcher.state !== "idle"}
              className="px-3 py-1.5 text-xs font-medium rounded-md"
              style={{
                background: "var(--color-bg-elev-1)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-dim)",
                cursor: "pointer",
              }}
            >
              Draw winner
            </button>
          </fetcher.Form>
        )}
        {giveaway.isMod && isActive && (
          <fetcher.Form method="post" action="/api/giveaway">
            <input type="hidden" name="intent" value="cancel" />
            <input type="hidden" name="giveawayId" value={giveaway.id} />
            <button
              type="submit"
              disabled={fetcher.state !== "idle"}
              className="px-3 py-1.5 text-xs rounded-md"
              style={{
                background: "none",
                border: "none",
                color: "var(--color-danger)",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </fetcher.Form>
        )}
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
