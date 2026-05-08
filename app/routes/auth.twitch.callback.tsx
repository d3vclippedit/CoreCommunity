import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";
import { eq } from "drizzle-orm";
import { exchangeTwitchCode, getTwitchUser } from "~/lib/auth/twitch";
import { createDb } from "~/lib/db/index";
import { users } from "../../db/schema";

function getRedirectUri(request: Request, appUrl?: string): string {
  if (appUrl) return `${appUrl.replace(/\/$/, "")}/auth/twitch/callback`;
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}/auth/twitch/callback`;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error || !code || !state) {
    return redirect("/settings?tab=connected&twitch_error=1");
  }

  const stored = await env.KV.get(`twitch_oauth:${state}`);
  if (!stored) return redirect("/settings?tab=connected&twitch_error=1");
  await env.KV.delete(`twitch_oauth:${state}`);

  const { userId } = JSON.parse(stored) as { userId: string };

  try {
    const redirectUri = getRedirectUri(request, env.APP_URL);
    if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) {
      console.error("Twitch OAuth: TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET env var not set");
      return redirect("/settings?tab=connected&twitch_error=1");
    }

    const tokens = await exchangeTwitchCode(
      env.TWITCH_CLIENT_ID,
      env.TWITCH_CLIENT_SECRET,
      code,
      redirectUri,
    );
    const twitchUser = await getTwitchUser(tokens.access_token, env.TWITCH_CLIENT_ID);

    const db = createDb(env.DB);

    const existing = await db.query.users.findFirst({
      where: eq(users.twitchId, twitchUser.id),
      columns: { id: true },
    });
    if (existing && existing.id !== userId) {
      return redirect("/settings?tab=connected&twitch_error=taken");
    }

    await db
      .update(users)
      .set({
        twitchId: twitchUser.id,
        twitchUsername: twitchUser.login,
        twitchLinkedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return redirect("/settings?tab=connected&twitch_ok=1");
  } catch (err) {
    console.error("Twitch OAuth callback error:", err);
    return redirect("/settings?tab=connected&twitch_error=1");
  }
}
