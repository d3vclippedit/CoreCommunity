import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";
import { and, eq, sql } from "drizzle-orm";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { checkRateLimit } from "~/lib/ratelimit";
import { communityMemberships, pollOptions, pollVotes, polls } from "../../db/schema";

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) return { error: "You must be logged in to vote." };

  const rl = await checkRateLimit(env.KV, "poll_vote", user.id, 60, 60);
  if (!rl.allowed) return { error: "Too many requests." };

  const form = await request.formData();
  const intent = form.get("intent") as string | null;

  if (intent === "vote") {
    const pollId = form.get("pollId") as string | null;
    const optionId = form.get("optionId") as string | null;
    if (!pollId || !optionId) return { error: "Missing fields." };

    const db = createDb(env.DB);

    const poll = await db.query.polls.findFirst({
      where: eq(polls.id, pollId),
      columns: { id: true, communityId: true, isClosed: true, endsAt: true },
    });
    if (!poll) return { error: "Poll not found." };

    if (poll.isClosed || (poll.endsAt && new Date(poll.endsAt) < new Date())) {
      return { error: "This poll has ended." };
    }

    const membership = await db.query.communityMemberships.findFirst({
      where: and(
        eq(communityMemberships.userId, user.id),
        eq(communityMemberships.communityId, poll.communityId),
      ),
      columns: { userId: true },
    });
    if (!membership) return { error: "You must be a member to vote." };

    const existing = await db.query.pollVotes.findFirst({
      where: and(eq(pollVotes.userId, user.id), eq(pollVotes.pollId, pollId)),
      columns: { userId: true },
    });
    if (existing) return { error: "You have already voted." };

    const option = await db.query.pollOptions.findFirst({
      where: and(eq(pollOptions.id, optionId), eq(pollOptions.pollId, pollId)),
      columns: { id: true },
    });
    if (!option) return { error: "Invalid option." };

    await db.insert(pollVotes).values({
      userId: user.id,
      pollId,
      optionId,
      createdAt: new Date(),
    });
    await db
      .update(pollOptions)
      .set({ voteCount: sql`${pollOptions.voteCount} + 1` })
      .where(eq(pollOptions.id, optionId));

    return { ok: true };
  }

  return { error: "Unknown action." };
}

export async function loader() {
  return redirect("/");
}
