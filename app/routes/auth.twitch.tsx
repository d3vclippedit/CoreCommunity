import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";
import { getTwitchAuthUrl } from "~/lib/auth/twitch";
import { getCurrentUser } from "~/lib/auth/user.server";
import { generateToken } from "~/lib/utils";

function getRedirectUri(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}/auth/twitch/callback`;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) return redirect("/auth/login");

  const state = generateToken();
  await env.KV.put(`twitch_oauth:${state}`, JSON.stringify({ userId: user.id }), {
    expirationTtl: 600,
  });

  return redirect(getTwitchAuthUrl(env.TWITCH_CLIENT_ID, getRedirectUri(request), state));
}

export async function action({ request, context }: ActionFunctionArgs) {
  return loader({ request, context, params: {} });
}
