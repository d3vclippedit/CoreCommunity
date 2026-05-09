import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { users } from "../../db/schema";

const ALWAYS_ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const GIF_MAX_BYTES = 5 * 1024 * 1024; // 5 MB for GIFs
const STATIC_MAX_BYTES = 2 * 1024 * 1024; // 2 MB for static images

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file") as File | null;
  if (!file) return Response.json({ error: "Missing file." }, { status: 400 });

  const isGif = file.type === "image/gif";

  if (isGif) {
    if (!user.gifAvatarUnlocked) {
      return Response.json(
        { error: "Animated GIF avatars are unlocked by spending $50 on Core Coins." },
        { status: 403 },
      );
    }
    if (file.size > GIF_MAX_BYTES) {
      return Response.json({ error: "GIF too large. Max 5 MB." }, { status: 400 });
    }
  } else {
    const ext = ALWAYS_ALLOWED[file.type];
    if (!ext) {
      return Response.json(
        { error: "Only PNG, JPG, WebP, or GIF images are supported." },
        { status: 400 },
      );
    }
    if (file.size > STATIC_MAX_BYTES) {
      return Response.json({ error: "File too large. Max 2 MB." }, { status: 400 });
    }
  }

  const ext = isGif ? "gif" : (ALWAYS_ALLOWED[file.type] as string);
  const key = `avatars/${user.id}/${crypto.randomUUID()}.${ext}`;

  await env.R2.put(key, file, {
    httpMetadata: {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });

  const db = createDb(env.DB);
  await db
    .update(users)
    .set({ avatarUrl: `/media/${key}`, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return Response.json({ url: `/media/${key}` });
}
