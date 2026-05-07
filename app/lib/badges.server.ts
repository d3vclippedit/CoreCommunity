// Badge application — atomic: debit coins → record application → boost post score
// All-or-nothing via D1 transaction. Earnings recorded server-side only.

import { and, eq, sql } from "drizzle-orm";
import { debitCoins } from "~/lib/coins.server";
import type { createDb } from "~/lib/db/index";
import {
  monetizationEarnings,
  postBadgeApplications,
  postBadgeDefinitions,
  posts,
  users,
} from "../../db/schema";

type Db = ReturnType<typeof createDb>;

// Server-side payout rate — never exposed to frontend
const CREATOR_PAYOUT_RATE = 0.7; // 70% to creator, 30% platform fee

export async function getActiveBadgeDefinitions(db: Db) {
  return db
    .select()
    .from(postBadgeDefinitions)
    .where(eq(postBadgeDefinitions.isActive, true))
    .orderBy(postBadgeDefinitions.displayOrder);
}

export async function applyBadge(
  db: Db,
  giverUserId: string,
  postId: string,
  badgeDefinitionId: string,
): Promise<{ applicationId: string; newBalance: number }> {
  // Verify post exists and get author
  const post = await db
    .select({
      authorId: posts.authorId,
      communityId: posts.communityId,
      removedAt: posts.removedAt,
    })
    .from(posts)
    .where(eq(posts.id, postId))
    .get();

  if (!post) throw new Error("POST_NOT_FOUND");
  if (post.removedAt) throw new Error("POST_REMOVED");
  if (post.authorId === giverUserId) throw new Error("CANNOT_BADGE_OWN_POST");

  // Verify badge definition
  const badgeDef = await db
    .select()
    .from(postBadgeDefinitions)
    .where(
      and(eq(postBadgeDefinitions.id, badgeDefinitionId), eq(postBadgeDefinitions.isActive, true)),
    )
    .get();

  if (!badgeDef) throw new Error("BADGE_NOT_FOUND");

  const applicationId = crypto.randomUUID();
  const now = new Date();

  // Atomic debit + record
  const newBalance = await debitCoins(
    db,
    giverUserId,
    badgeDef.coinCost,
    "spend",
    "post_badge",
    applicationId,
    `${badgeDef.name} badge on post ${postId}`,
  );

  // Record badge application
  await db.insert(postBadgeApplications).values({
    id: applicationId,
    postId,
    communityId: post.communityId,
    giverUserId,
    recipientUserId: post.authorId,
    badgeDefinitionId,
    coinAmount: badgeDef.coinCost,
    createdAt: now,
  });

  // Boost post badge_score (log-scale so large amounts don't dominate entirely)
  const scoreBoost = badgeDef.visibilityWeight;
  await db
    .update(posts)
    .set({ badgeScore: sql`${posts.badgeScore} + ${scoreBoost}` })
    .where(eq(posts.id, postId));

  // Record earnings for creator (server-side only)
  const grossCoins = badgeDef.coinCost;
  const platformFeeCoins = Math.floor(grossCoins * (1 - CREATOR_PAYOUT_RATE));
  const netCoins = grossCoins - platformFeeCoins;

  await db.insert(monetizationEarnings).values({
    id: crypto.randomUUID(),
    userId: post.authorId,
    postId,
    badgeApplicationId: applicationId,
    grossCoins,
    platformFeeCoins,
    netCoins,
    status: "pending",
    createdAt: now,
  });

  return { applicationId, newBalance };
}

// Returns stacked badge summary for a post: [{badgeDef, count, totalCoins}]
export async function getPostBadgeSummary(db: Db, postId: string) {
  const rows = await db
    .select({
      badgeDefinitionId: postBadgeApplications.badgeDefinitionId,
      count: sql<number>`count(*)`,
      totalCoins: sql<number>`sum(${postBadgeApplications.coinAmount})`,
      name: postBadgeDefinitions.name,
      icon: postBadgeDefinitions.icon,
      coinCost: postBadgeDefinitions.coinCost,
      displayOrder: postBadgeDefinitions.displayOrder,
    })
    .from(postBadgeApplications)
    .innerJoin(
      postBadgeDefinitions,
      eq(postBadgeApplications.badgeDefinitionId, postBadgeDefinitions.id),
    )
    .where(eq(postBadgeApplications.postId, postId))
    .groupBy(postBadgeApplications.badgeDefinitionId)
    .orderBy(postBadgeDefinitions.displayOrder);

  return rows;
}

// Verify user has enough coins for a badge
export async function canAffordBadge(
  db: Db,
  userId: string,
  badgeDefinitionId: string,
): Promise<boolean> {
  const [, badge] = await Promise.all([
    db.select({ id: users.id }).from(users).where(eq(users.id, userId)).get(),
    db
      .select({ coinCost: postBadgeDefinitions.coinCost })
      .from(postBadgeDefinitions)
      .where(eq(postBadgeDefinitions.id, badgeDefinitionId))
      .get(),
  ]);
  if (!badge) return false;
  const { getBalance } = await import("~/lib/coins.server");
  const balance = await getBalance(db, userId);
  return balance >= badge.coinCost;
}
