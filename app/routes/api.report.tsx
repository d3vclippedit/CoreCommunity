import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { checkRateLimit } from "~/lib/ratelimit";
import { generateId } from "~/lib/utils";
import type { ReportTargetType } from "../../db/schema";
import { reports } from "../../db/schema";

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) return { error: "You must be logged in to report content." };

  const rl = await checkRateLimit(env.KV, "report", user.id, 5, 3600);
  if (!rl.allowed) return { error: "Too many reports. Try again later." };

  const form = await request.formData();
  const targetType = form.get("targetType") as ReportTargetType | null;
  const targetId = form.get("targetId") as string | null;
  const communityId = form.get("communityId") as string | null;
  const reason = form.get("reason") as string | null;
  const details = (form.get("details") as string | null)?.trim() || null;

  const validTargetTypes: ReportTargetType[] = ["post", "comment", "community"];
  if (!targetType || !validTargetTypes.includes(targetType) || !targetId || !communityId || !reason)
    return { error: "Missing required fields." };

  const validReasons = ["spam", "harassment", "nsfw", "off_topic", "other"];
  if (!validReasons.includes(reason)) return { error: "Invalid reason." };

  const db = createDb(env.DB);
  await db.insert(reports).values({
    id: generateId(),
    reporterId: user.id,
    targetType,
    targetId,
    communityId,
    reason: reason as "spam" | "harassment" | "nsfw" | "off_topic" | "other",
    details,
    status: "open",
    createdAt: new Date(),
  });

  return { ok: true };
}

export async function loader() {
  return redirect("/");
}
