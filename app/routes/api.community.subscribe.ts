import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "~/lib/auth/user.server";
import { debitCoins, getBalance } from "~/lib/coins.server";
import { createDb } from "~/lib/db/index";
import { generateId } from "~/lib/utils";
import { communities, communitySubscriptions } from "../../db/schema";

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) return Response.json({ error: "Not signed in." }, { status: 401 });

  const form = await request.formData();
  const communityId = form.get("communityId") as string | null;
  if (!communityId) return Response.json({ error: "Missing communityId." }, { status: 400 });

  const db = createDb(env.DB);

  const community = await db.query.communities.findFirst({
    where: eq(communities.id, communityId),
    columns: { id: true, membershipEnabled: true, membershipPriceCoins: true },
  });
  if (!community?.membershipEnabled)
    return Response.json(
      { error: "This community does not have membership enabled." },
      { status: 400 },
    );

  const existing = await db.query.communitySubscriptions.findFirst({
    where: and(
      eq(communitySubscriptions.userId, user.id),
      eq(communitySubscriptions.communityId, communityId),
      eq(communitySubscriptions.status, "active"),
    ),
    columns: { id: true },
  });
  if (existing) return Response.json({ error: "Already subscribed." }, { status: 400 });

  const MEMBERSHIP_PRICE = 850;

  const balance = await getBalance(db, user.id);
  if (balance < MEMBERSHIP_PRICE)
    return Response.json(
      { error: `Not enough Core Coins. You need ${MEMBERSHIP_PRICE} cc.` },
      { status: 400 },
    );

  const now = new Date();
  const nextChargeAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await debitCoins(
    db,
    user.id,
    MEMBERSHIP_PRICE,
    "spend",
    "community_membership",
    communityId,
    null,
  );

  await db.insert(communitySubscriptions).values({
    id: generateId(),
    userId: user.id,
    communityId,
    status: "active",
    coinsPerWeek: MEMBERSHIP_PRICE,
    nextChargeAt,
    createdAt: now,
    updatedAt: now,
  });

  return Response.json({ success: true });
}
