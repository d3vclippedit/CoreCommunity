import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import { getCurrentUser } from "~/lib/auth/user.server";

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

const IMAGE_MAX = 10 * 1024 * 1024;
const VIDEO_MAX = 100 * 1024 * 1024;

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.emailVerifiedAt)
    return Response.json({ error: "Verify your email before uploading." }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file") as File | null;
  if (!file) return Response.json({ error: "Missing file." }, { status: 400 });

  const isImage = file.type in IMAGE_TYPES;
  const isVideo = file.type in VIDEO_TYPES;

  if (!isImage && !isVideo) {
    return Response.json(
      { error: "Unsupported type. Images: JPG, PNG, WebP, GIF. Videos: MP4, WebM, MOV." },
      { status: 400 },
    );
  }

  const maxSize = isImage ? IMAGE_MAX : VIDEO_MAX;
  if (file.size > maxSize) {
    return Response.json(
      { error: `File too large. Max ${isImage ? "10 MB" : "100 MB"}.` },
      { status: 400 },
    );
  }

  const ext = isImage ? IMAGE_TYPES[file.type] : VIDEO_TYPES[file.type];
  const folder = isImage ? "images" : "videos";
  const key = `posts/${folder}/${user.id}/${crypto.randomUUID()}.${ext}`;

  await env.R2.put(key, file, {
    httpMetadata: {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });

  return Response.json({ url: `/media/${key}`, kind: isImage ? "image" : "video" });
}
