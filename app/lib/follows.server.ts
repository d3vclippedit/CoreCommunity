import { and, eq, sql } from "drizzle-orm";
import type { createDb } from "~/lib/db/index";
import { follows, users } from "../../db/schema";

type Db = ReturnType<typeof createDb>;

export async function followUser(db: Db, followerId: string, followeeId: string): Promise<void> {
  if (followerId === followeeId) throw new Error("CANNOT_FOLLOW_SELF");

  await db.transaction(async (tx) => {
    await tx
      .insert(follows)
      .values({ followerId, followeeId, createdAt: new Date() })
      .onConflictDoNothing();

    // Update denormalized counts
    await tx.update(users).set({ followingCount: sql`${users.followingCount} + 1` }).where(eq(users.id, followerId));
    await tx.update(users).set({ followerCount: sql`${users.followerCount} + 1` }).where(eq(users.id, followeeId));
  });
}

export async function unfollowUser(db: Db, followerId: string, followeeId: string): Promise<void> {
  const existing = await db
    .select({ followerId: follows.followerId })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)))
    .get();

  if (!existing) return;

  await db.transaction(async (tx) => {
    await tx
      .delete(follows)
      .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));

    await tx.update(users).set({ followingCount: sql`max(0, ${users.followingCount} - 1)` }).where(eq(users.id, followerId));
    await tx.update(users).set({ followerCount: sql`max(0, ${users.followerCount} - 1)` }).where(eq(users.id, followeeId));
  });
}

export async function isFollowing(db: Db, followerId: string, followeeId: string): Promise<boolean> {
  const row = await db
    .select({ followerId: follows.followerId })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)))
    .get();
  return !!row;
}

export async function getFollowerCount(db: Db, userId: string): Promise<number> {
  const row = await db.select({ followerCount: users.followerCount }).from(users).where(eq(users.id, userId)).get();
  return row?.followerCount ?? 0;
}
