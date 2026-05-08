// Creator monetization eligibility — all calculation server-side only.
// Payout rates, eligibility thresholds, and earnings amounts are NEVER
// sent to the frontend as raw numbers. Frontend gets only eligibility
// booleans and progress fractions.

import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import type { createDb } from "~/lib/db/index";
import {
  communityMemberships,
  follows,
  monetizationEarnings,
  monetizationPayouts,
  pioneerEnrollments,
  postBadgeApplications,
  posts,
} from "../../db/schema";

type Db = ReturnType<typeof createDb>;

// ── Base Creator tier ─────────────────────────────────────────────────────────

const CREATOR = {
  minFollowers: 50,
  minPostsLast28Days: 20,
  minBadgeCCLast28Days: 500,
  windowDays: 28,
} as const;

export interface EligibilityResult {
  isEligible: boolean;
  followerCount: number;
  followerGoal: number;
  postCount: number;
  postGoal: number;
  badgeValueMet: boolean;
  missingRequirements: ("followers" | "posts" | "badge_value")[];
}

export async function checkEligibility(db: Db, userId: string): Promise<EligibilityResult> {
  const windowStart = new Date(Date.now() - CREATOR.windowDays * 86400 * 1000);

  const [followerRow, postCountRow, earningsRow] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followeeId, userId))
      .get(),
    db
      .select({ count: sql<number>`count(*)` })
      .from(posts)
      .where(and(eq(posts.authorId, userId), gte(posts.createdAt, windowStart)))
      .get(),
    db
      .select({ totalCoins: sql<number>`coalesce(sum(${monetizationEarnings.grossCoins}), 0)` })
      .from(monetizationEarnings)
      .where(
        and(eq(monetizationEarnings.userId, userId), gte(monetizationEarnings.createdAt, windowStart)),
      )
      .get(),
  ]);

  const followerCount = followerRow?.count ?? 0;
  const postCount = postCountRow?.count ?? 0;
  const totalCC = earningsRow?.totalCoins ?? 0;

  const missing: EligibilityResult["missingRequirements"] = [];
  if (followerCount < CREATOR.minFollowers) missing.push("followers");
  if (postCount < CREATOR.minPostsLast28Days) missing.push("posts");
  if (totalCC < CREATOR.minBadgeCCLast28Days) missing.push("badge_value");

  return {
    isEligible: missing.length === 0,
    followerCount,
    followerGoal: CREATOR.minFollowers,
    postCount,
    postGoal: CREATOR.minPostsLast28Days,
    badgeValueMet: totalCC >= CREATOR.minBadgeCCLast28Days,
    missingRequirements: missing,
  };
}

// ── Partner tier ──────────────────────────────────────────────────────────────

const PARTNER = {
  minFollowers: 500,
  minPostsLast28Days: 30,
  minViewsAcrossPostsLast28Days: 10_000,
  minBadgeCCLast28Days: 25_000,
  windowDays: 28,
} as const;

export interface PartnerEligibilityResult {
  isEligible: boolean;
  followerCount: number;
  followerGoal: number;
  postCount: number;
  postGoal: number;
  totalViewsOnRecentPosts: number;
  viewGoal: number;
  badgeValueMet: boolean;
  missingRequirements: ("followers" | "posts" | "views" | "badge_value")[];
}

export async function checkPartnerEligibility(
  db: Db,
  userId: string,
): Promise<PartnerEligibilityResult> {
  const windowStart = new Date(Date.now() - PARTNER.windowDays * 86400 * 1000);

  const [followerRow, postViewRow, earningsRow] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followeeId, userId))
      .get(),
    // Posts in window — count + total views
    db
      .select({
        postCount: sql<number>`count(*)`,
        totalViews: sql<number>`coalesce(sum(${posts.viewCount}), 0)`,
      })
      .from(posts)
      .where(
        and(eq(posts.authorId, userId), gte(posts.createdAt, windowStart), sql`${posts.removedAt} IS NULL`),
      )
      .get(),
    db
      .select({ totalCoins: sql<number>`coalesce(sum(${monetizationEarnings.grossCoins}), 0)` })
      .from(monetizationEarnings)
      .where(
        and(eq(monetizationEarnings.userId, userId), gte(monetizationEarnings.createdAt, windowStart)),
      )
      .get(),
  ]);

  const followerCount = followerRow?.count ?? 0;
  const postCount = postViewRow?.postCount ?? 0;
  const totalViews = postViewRow?.totalViews ?? 0;
  const totalCC = earningsRow?.totalCoins ?? 0;

  const missing: PartnerEligibilityResult["missingRequirements"] = [];
  if (followerCount < PARTNER.minFollowers) missing.push("followers");
  if (postCount < PARTNER.minPostsLast28Days) missing.push("posts");
  if (totalViews < PARTNER.minViewsAcrossPostsLast28Days) missing.push("views");
  if (totalCC < PARTNER.minBadgeCCLast28Days) missing.push("badge_value");

  return {
    isEligible: missing.length === 0,
    followerCount,
    followerGoal: PARTNER.minFollowers,
    postCount,
    postGoal: PARTNER.minPostsLast28Days,
    totalViewsOnRecentPosts: totalViews,
    viewGoal: PARTNER.minViewsAcrossPostsLast28Days,
    badgeValueMet: totalCC >= PARTNER.minBadgeCCLast28Days,
    missingRequirements: missing,
  };
}

// ── Pioneer tier ──────────────────────────────────────────────────────────────

export interface PioneerEnrollment {
  id: string;
  communityId: string;
  contractRef: string | null;
  enrolledAt: Date;
  expiresAt: Date | null;
  isActive: boolean;
}

export async function getPioneerEnrollment(
  db: Db,
  userId: string,
): Promise<PioneerEnrollment | null> {
  const row = await db
    .select()
    .from(pioneerEnrollments)
    .where(and(eq(pioneerEnrollments.userId, userId), eq(pioneerEnrollments.isActive, true)))
    .get();
  if (!row) return null;
  return {
    id: row.id,
    communityId: row.communityId,
    contractRef: row.contractRef,
    enrolledAt: row.enrolledAt,
    expiresAt: row.expiresAt,
    isActive: row.isActive,
  };
}

export interface PioneerWindowMetrics {
  window: "1d" | "3d" | "7d" | "28d";
  ccSpent: number;
  newMembers: number;
  recurringMembers: number;
  postCount: number;
}

export async function getPioneerMetrics(
  db: Db,
  communityId: string,
): Promise<PioneerWindowMetrics[]> {
  const windows = [
    { label: "1d" as const, days: 1 },
    { label: "3d" as const, days: 3 },
    { label: "7d" as const, days: 7 },
    { label: "28d" as const, days: 28 },
  ];

  return Promise.all(
    windows.map(async ({ label, days }) => {
      const windowStart = new Date(Date.now() - days * 86400 * 1000);

      const [ccRow, newMemberRow, postRow, allMembersBeforeWindow, activeInWindow] =
        await Promise.all([
          // CC spent on this community's posts in window
          db
            .select({ total: sql<number>`coalesce(sum(${postBadgeApplications.coinAmount}), 0)` })
            .from(postBadgeApplications)
            .where(
              and(
                eq(postBadgeApplications.communityId, communityId),
                gte(postBadgeApplications.createdAt, windowStart),
              ),
            )
            .get(),
          // Members who first joined this community inside the window
          db
            .select({ count: sql<number>`count(*)` })
            .from(communityMemberships)
            .where(
              and(
                eq(communityMemberships.communityId, communityId),
                gte(communityMemberships.joinedAt, windowStart),
              ),
            )
            .get(),
          // Posts created in window
          db
            .select({ count: sql<number>`count(*)` })
            .from(posts)
            .where(
              and(
                eq(posts.communityId, communityId),
                sql`${posts.removedAt} IS NULL`,
                gte(posts.createdAt, windowStart),
              ),
            )
            .get(),
          // Members who joined BEFORE the window
          db
            .select({ userId: communityMemberships.userId })
            .from(communityMemberships)
            .where(
              and(
                eq(communityMemberships.communityId, communityId),
                lt(communityMemberships.joinedAt, windowStart),
              ),
            ),
          // Members who posted in community within the window
          db
            .select({ authorId: posts.authorId })
            .from(posts)
            .where(
              and(
                eq(posts.communityId, communityId),
                sql`${posts.removedAt} IS NULL`,
                gte(posts.createdAt, windowStart),
              ),
            ),
        ]);

      // Recurring = was a member before the window AND posted in the window
      const priorMemberSet = new Set(allMembersBeforeWindow.map((m) => m.userId));
      const activeAuthorSet = new Set(activeInWindow.map((p) => p.authorId));
      const recurringMembers = [...activeAuthorSet].filter((id) => priorMemberSet.has(id)).length;

      return {
        window: label,
        ccSpent: ccRow?.total ?? 0,
        newMembers: newMemberRow?.count ?? 0,
        recurringMembers,
        postCount: postRow?.count ?? 0,
      };
    }),
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

export async function updateEarningStatuses(db: Db, userId: string, isEligible: boolean) {
  if (!isEligible) return;
  await db
    .update(monetizationEarnings)
    .set({ status: "eligible" })
    .where(
      and(eq(monetizationEarnings.userId, userId), eq(monetizationEarnings.status, "pending")),
    );
}

export async function getPayoutHistory(db: Db, userId: string) {
  return db
    .select()
    .from(monetizationPayouts)
    .where(eq(monetizationPayouts.userId, userId))
    .orderBy(desc(monetizationPayouts.createdAt))
    .limit(20);
}
