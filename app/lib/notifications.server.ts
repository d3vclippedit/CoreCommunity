import { eq, inArray } from "drizzle-orm";
import type { createDb } from "~/lib/db/index";
import { generateId } from "~/lib/utils";
import { comments, notifications, posts, users } from "../../db/schema";

export async function createMentionNotifications(
  db: ReturnType<typeof createDb>,
  {
    body,
    actorId,
    communityId,
    postId,
    commentId,
  }: {
    body: string | null;
    actorId: string;
    communityId: string;
    postId: string;
    commentId?: string;
  },
) {
  if (!body) return;

  // Strip HTML tags, then extract @handle patterns (same regex as renderMentions)
  const text = body.replace(/<[^>]*>/g, " ");
  const matches = text.matchAll(/@([a-z0-9_]{3,20})\b/gi);
  const handles = [...new Set([...matches].map((m) => m[1].toLowerCase()))];
  if (handles.length === 0) return;

  const mentioned = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.handle, handles));

  const toNotify = mentioned.filter((u) => u.id !== actorId);
  if (toNotify.length === 0) return;

  const now = new Date();
  await db.insert(notifications).values(
    toNotify.map((u) => ({
      id: generateId(),
      userId: u.id,
      type: "mention" as const,
      actorId,
      communityId,
      postId,
      commentId: commentId ?? null,
      createdAt: now,
    })),
  );
}

export async function createPostCommentNotification(
  db: ReturnType<typeof createDb>,
  {
    postAuthorId,
    actorId,
    communityId,
    postId,
    commentId,
  }: {
    postAuthorId: string;
    actorId: string;
    communityId: string;
    postId: string;
    commentId: string;
  },
) {
  if (postAuthorId === actorId) return;

  const pref = await db.query.users.findFirst({
    where: eq(users.id, postAuthorId),
    columns: { notifyOnPostComment: true },
  });
  if (!pref?.notifyOnPostComment) return;

  await db.insert(notifications).values({
    id: generateId(),
    userId: postAuthorId,
    type: "post_comment" as const,
    actorId,
    communityId,
    postId,
    commentId,
    createdAt: new Date(),
  });
}

export async function createCommentReplyNotification(
  db: ReturnType<typeof createDb>,
  {
    parentCommentId,
    actorId,
    communityId,
    postId,
    commentId,
  }: {
    parentCommentId: string;
    actorId: string;
    communityId: string;
    postId: string;
    commentId: string;
  },
) {
  const parent = await db.query.comments.findFirst({
    where: eq(comments.id, parentCommentId),
    columns: { authorId: true },
  });
  if (!parent || parent.authorId === actorId) return;

  const pref = await db.query.users.findFirst({
    where: eq(users.id, parent.authorId),
    columns: { notifyOnCommentReply: true },
  });
  if (!pref?.notifyOnCommentReply) return;

  await db.insert(notifications).values({
    id: generateId(),
    userId: parent.authorId,
    type: "comment_reply" as const,
    actorId,
    communityId,
    postId,
    commentId,
    createdAt: new Date(),
  });
}

export async function createCommentLikeNotification(
  db: ReturnType<typeof createDb>,
  { commentId, actorId }: { commentId: string; actorId: string },
) {
  const comment = await db.query.comments.findFirst({
    where: eq(comments.id, commentId),
    columns: { authorId: true, postId: true },
  });
  if (!comment || comment.authorId === actorId) return;

  const pref = await db.query.users.findFirst({
    where: eq(users.id, comment.authorId),
    columns: { notifyOnCommentLike: true },
  });
  if (!pref?.notifyOnCommentLike) return;

  const post = await db.query.posts.findFirst({
    where: eq(posts.id, comment.postId),
    columns: { communityId: true },
  });

  await db.insert(notifications).values({
    id: generateId(),
    userId: comment.authorId,
    type: "comment_like" as const,
    actorId,
    communityId: post?.communityId ?? null,
    postId: comment.postId,
    commentId,
    createdAt: new Date(),
  });
}

export async function createPostUpvoteNotification(
  db: ReturnType<typeof createDb>,
  {
    postAuthorId,
    actorId,
    communityId,
    postId,
  }: {
    postAuthorId: string;
    actorId: string;
    communityId: string | null;
    postId: string;
  },
) {
  if (postAuthorId === actorId) return;

  const pref = await db.query.users.findFirst({
    where: eq(users.id, postAuthorId),
    columns: { notifyOnPostUpvote: true },
  });
  if (!pref?.notifyOnPostUpvote) return;

  await db.insert(notifications).values({
    id: generateId(),
    userId: postAuthorId,
    type: "post_upvote" as const,
    actorId,
    communityId,
    postId,
    createdAt: new Date(),
  });
}
