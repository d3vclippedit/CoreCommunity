import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";
import { and, count, eq, isNull } from "drizzle-orm";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { checkRateLimit } from "~/lib/ratelimit";
import { generateId } from "~/lib/utils";
import { communityMemberships, giveawayEntries, giveaways, posts } from "../../db/schema";

// Giveaway creation is handled via the post submit page (type=giveaway tab).
// This API handles enter, draw, and cancel intents only.

function isMod(role: string | undefined | null): boolean {
  return role === "mod" || role === "senior_mod" || role === "admin" || role === "streamer";
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) return { error: "You must be logged in." };

  const rl = await checkRateLimit(env.KV, "giveaway", user.id, 20, 60);
  if (!rl.allowed) return { error: "Too many requests." };

  const form = await request.formData();
  const intent = form.get("intent") as string | null;
  const db = createDb(env.DB);

  if (intent === "enter") {
    const giveawayId = form.get("giveawayId") as string | null;
    if (!giveawayId) return { error: "Missing giveaway ID." };

    const giveaway = await db.query.giveaways.findFirst({
      where: eq(giveaways.id, giveawayId),
    });
    if (!giveaway || giveaway.status !== "active") return { error: "Giveaway is not active." };
    if (giveaway.endsAt && new Date(giveaway.endsAt) < new Date()) {
      return { error: "Giveaway has ended." };
    }

    const membership = await db.query.communityMemberships.findFirst({
      where: and(
        eq(communityMemberships.userId, user.id),
        eq(communityMemberships.communityId, giveaway.communityId),
      ),
      columns: { role: true, joinedAt: true },
    });
    if (!membership) return { error: "You must be a member to enter." };

    if (giveaway.minMembershipDays !== null) {
      const daysSince = (Date.now() - new Date(membership.joinedAt).getTime()) / 86_400_000;
      if (daysSince < giveaway.minMembershipDays) {
        return {
          error: `You must have been a member for at least ${giveaway.minMembershipDays} day(s) to enter.`,
        };
      }
    }

    if (giveaway.minPostCount !== null) {
      const [row] = await db
        .select({ n: count() })
        .from(posts)
        .where(
          and(
            eq(posts.authorId, user.id),
            eq(posts.communityId, giveaway.communityId),
            isNull(posts.removedAt),
          ),
        );
      if ((row?.n ?? 0) < giveaway.minPostCount) {
        return {
          error: `You must have at least ${giveaway.minPostCount} post(s) in this community to enter.`,
        };
      }
    }

    const existing = await db.query.giveawayEntries.findFirst({
      where: and(eq(giveawayEntries.giveawayId, giveawayId), eq(giveawayEntries.userId, user.id)),
      columns: { id: true },
    });
    if (existing) return { error: "You have already entered." };

    await db.insert(giveawayEntries).values({
      id: generateId(),
      giveawayId,
      userId: user.id,
      enteredAt: new Date(),
    });

    return { ok: true };
  }

  if (intent === "draw") {
    const giveawayId = form.get("giveawayId") as string | null;
    if (!giveawayId) return { error: "Missing giveaway ID." };

    const giveaway = await db.query.giveaways.findFirst({
      where: eq(giveaways.id, giveawayId),
      columns: { id: true, communityId: true, status: true },
    });
    if (!giveaway) return { error: "Not found." };

    const membership = await db.query.communityMemberships.findFirst({
      where: and(
        eq(communityMemberships.userId, user.id),
        eq(communityMemberships.communityId, giveaway.communityId),
      ),
      columns: { role: true },
    });
    if (!isMod(membership?.role)) return { error: "Only moderators can draw winners." };

    const entries = await db.query.giveawayEntries.findMany({
      where: eq(giveawayEntries.giveawayId, giveawayId),
      columns: { userId: true },
    });
    if (entries.length === 0) return { error: "No entries to draw from." };

    const winner = entries[Math.floor(Math.random() * entries.length)];
    const now = new Date();
    await db
      .update(giveaways)
      .set({ winnerUserId: winner?.userId, winnerDrawnAt: now, status: "ended", updatedAt: now })
      .where(eq(giveaways.id, giveawayId));

    return { ok: true, winnerId: winner?.userId };
  }

  if (intent === "cancel") {
    const giveawayId = form.get("giveawayId") as string | null;
    if (!giveawayId) return { error: "Missing giveaway ID." };

    const giveaway = await db.query.giveaways.findFirst({
      where: eq(giveaways.id, giveawayId),
      columns: { id: true, communityId: true },
    });
    if (!giveaway) return { error: "Not found." };

    const membership = await db.query.communityMemberships.findFirst({
      where: and(
        eq(communityMemberships.userId, user.id),
        eq(communityMemberships.communityId, giveaway.communityId),
      ),
      columns: { role: true },
    });
    if (!isMod(membership?.role)) return { error: "Only moderators can cancel giveaways." };

    await db
      .update(giveaways)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(giveaways.id, giveawayId));

    return { ok: true };
  }

  return { error: "Unknown action." };
}

export async function loader() {
  return redirect("/");
}
