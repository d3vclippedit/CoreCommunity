import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { and, eq, isNull } from "drizzle-orm";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { canManageRules } from "~/lib/permissions";
import { communities, communityMemberships } from "../../db/schema";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_BYTES: Record<string, number> = {
  icon: 2 * 1024 * 1024,       // 2 MB
  banner: 4 * 1024 * 1024,     // 4 MB
  background: 8 * 1024 * 1024, // 8 MB
};

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file") as File | null;
  const communitySlug = (form.get("communitySlug") as string | null)?.trim();
  const imageType = (form.get("imageType") as string | null)?.trim();

  if (!file || !communitySlug || !imageType) {
    return Response.json({ error: "Missing required fields." }, { status: 400 });
  }

  if (!["icon", "banner", "background"].includes(imageType)) {
    return Response.json({ error: "Invalid image type." }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return Response.json({ error: "Only PNG, JPG, and WebP images are supported." }, { status: 400 });
  }

  const maxBytes = MAX_BYTES[imageType];
  if (file.size > maxBytes) {
    return Response.json(
      { error: `File too large. Max ${maxBytes / 1024 / 1024} MB for ${imageType}.` },
      { status: 400 },
    );
  }

  const db = createDb(env.DB);
  const community = await db.query.communities.findFirst({
    where: and(eq(communities.slug, communitySlug), isNull(communities.deletedAt)),
    columns: { id: true, slug: true },
  });
  if (!community) return Response.json({ error: "Community not found." }, { status: 404 });

  const membership = await db.query.communityMemberships.findFirst({
    where: and(
      eq(communityMemberships.userId, user.id),
      eq(communityMemberships.communityId, community.id),
    ),
    columns: { role: true },
  });

  if (!canManageRules(membership?.role) && !user.isPlatformAdmin) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const key = `communities/${communitySlug}/${imageType}/${crypto.randomUUID()}.${ext}`;

  await env.R2.put(key, file, {
    httpMetadata: {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });

  return Response.json({ url: `/media/${key}` });
}
