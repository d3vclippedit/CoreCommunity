import { inArray } from "drizzle-orm";
import type { createDb } from "~/lib/db/index";
import { generateId } from "~/lib/utils";
import { notifications, users } from "../../db/schema";

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
