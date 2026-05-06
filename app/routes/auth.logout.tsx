import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { redirect } from "@remix-run/react";
import { clearSessionCookie, deleteSession, getSessionToken } from "~/lib/auth/session";

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const token = getSessionToken(request);
  if (token) await deleteSession(env.KV, token);
  return redirect("/", { headers: { "Set-Cookie": clearSessionCookie() } });
}

// GET logout — redirect home
export async function loader() {
  return redirect("/");
}
