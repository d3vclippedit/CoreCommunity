// Creator monetization eligibility — all calculation server-side only.
// Payout rates, eligibility thresholds, and earnings amounts are NEVER
// sent to the frontend as raw numbers. Frontend gets only eligibility
// booleans and progress fractions.

import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { createDb } from "~/lib/db/index";
import { follows, monetizationEarnings, monetizationPayouts, posts } from "../../db/schema";

type Db = ReturnType<typeof createDb>;

// Eligibility thresholds — edit here or move to DB settings table for full admin control
const ELIGIBILITY = {
  minFollowers: 50,
  minBadgeValueCentsLast28Days: 500, // $5.00 worth of badges
  minPostsLast28Days: 20,
  windowDays: 28,
} as const;

export interface EligibilityResult {
  isEligible: boolean;
  followerCount: number;
  followerGoal: number;
  postCount: number;
  postGoal: number;
  badgeValueMet: boolean; // don't reveal exact amount
  missingRequirements: ("followers" | "posts" | "badge_value")[];
}

export async function checkEligibility(db: Db, userId: string): Promise<EligibilityResult> {
  const windowStart = new Date(Date.now() - ELIGIBILITY.windowDays * 86400 * 1000);

  const [followerRow, postCountRow, earningsRow] = await Promise.all([
    // Follower count
    db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followeeId, userId))
      .get(),
    // Posts in last 28 days
    db
      .select({ count: sql<number>`count(*)` })
      .from(posts)
      .where(and(eq(posts.authorId, userId), gte(posts.createdAt, windowStart)))
      .get(),
    // Badge earnings in last 28 days
    db
      .select({ totalCoins: sql<number>`coalesce(sum(${monetizationEarnings.grossCoins}), 0)` })
      .from(monetizationEarnings)
      .where(and(eq(monetizationEarnings.userId, userId), gte(monetizationEarnings.createdAt, windowStart)))
      .get(),
  ]);

  const followerCount = followerRow?.count ?? 0;
  const postCount = postCountRow?.count ?? 0;
  const totalEarningsCents = Math.floor((earningsRow?.totalCoins ?? 0)); // 1 coin = $0.01 value

  const missingRequirements: EligibilityResult["missingRequirements"] = [];
  if (followerCount < ELIGIBILITY.minFollowers) missingRequirements.push("followers");
  if (postCount < ELIGIBILITY.minPostsLast28Days) missingRequirements.push("posts");
  if (totalEarningsCents < ELIGIBILITY.minBadgeValueCentsLast28Days) missingRequirements.push("badge_value");

  return {
    isEligible: missingRequirements.length === 0,
    followerCount,
    followerGoal: ELIGIBILITY.minFollowers,
    postCount,
    postGoal: ELIGIBILITY.minPostsLast28Days,
    badgeValueMet: totalEarningsCents >= ELIGIBILITY.minBadgeValueCentsLast28Days,
    missingRequirements,
  };
}

// Update pending earnings to eligible/paid when user qualifies
export async function updateEarningStatuses(db: Db, userId: string, isEligible: boolean) {
  if (!isEligible) return;
  await db
    .update(monetizationEarnings)
    .set({ status: "eligible" })
    .where(and(eq(monetizationEarnings.userId, userId), eq(monetizationEarnings.status, "pending")));
}

// Total pending/eligible earnings — for admin use only, not shown raw to users
export async function getEarningsSummary(db: Db, userId: string) {
  const rows = await db
    .select({
      status: monetizationEarnings.status,
      total: sql<number>`coalesce(sum(${monetizationEarnings.netCoins}), 0)`,
    })
    .from(monetizationEarnings)
    .where(eq(monetizationEarnings.userId, userId))
    .groupBy(monetizationEarnings.status);

  return Object.fromEntries(rows.map((r) => [r.status, r.total])) as Record<string, number>;
}

export async function getPayoutHistory(db: Db, userId: string) {
  return db
    .select()
    .from(monetizationPayouts)
    .where(eq(monetizationPayouts.userId, userId))
    .orderBy(desc(monetizationPayouts.createdAt))
    .limit(20);
}
