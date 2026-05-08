import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { and, eq, isNull } from "drizzle-orm";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Alert } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { parseEmbed } from "~/lib/embeds";
import { resolvePostPerms } from "~/lib/permissions";
import { checkRateLimit } from "~/lib/ratelimit";
import { generateId } from "~/lib/utils";
import {
  communities,
  communityCustomRoles,
  communityMemberships,
  communitySections,
  posts,
} from "../../db/schema";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data ? `Submit to c/${data.slug} — CORE` : "Cormunities" },
];

async function loadPerms(
  db: ReturnType<typeof import("~/lib/db/index").createDb>,
  userId: string,
  communityId: string,
  community: typeof communities.$inferSelect,
) {
  const membership = await db.query.communityMemberships.findFirst({
    where: and(
      eq(communityMemberships.userId, userId),
      eq(communityMemberships.communityId, communityId),
    ),
    columns: { role: true, customRoleId: true },
  });

  let customRole = null;
  if (membership?.customRoleId) {
    customRole =
      (await db
        .select({
          canPostLinks: communityCustomRoles.canPostLinks,
          canPostImages: communityCustomRoles.canPostImages,
          canPostVideos: communityCustomRoles.canPostVideos,
          postsPerHour: communityCustomRoles.postsPerHour,
        })
        .from(communityCustomRoles)
        .where(eq(communityCustomRoles.id, membership.customRoleId))
        .get()) ?? null;
  }

  return resolvePostPerms(membership?.role, community, customRole);
}

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) return redirect("/auth/login");

  const db = createDb(env.DB);
  const community = await db.query.communities.findFirst({
    where: and(eq(communities.slug, params.slug ?? ""), isNull(communities.deletedAt)),
  });
  if (!community) throw new Response("Community not found", { status: 404 });

  const perms = await loadPerms(db, user.id, community.id, community);

  return { slug: community.slug, name: community.name, perms };
}

export async function action({ params, request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) return redirect("/auth/login");
  if (!user.emailVerifiedAt) return { error: "You must verify your email before posting." };

  const db = createDb(env.DB);
  const community = await db.query.communities.findFirst({
    where: and(eq(communities.slug, params.slug ?? ""), isNull(communities.deletedAt)),
  });
  if (!community) throw new Response("Community not found", { status: 404 });

  const perms = await loadPerms(db, user.id, community.id, community);

  if (perms.postsPerHour > 0) {
    const rl = await checkRateLimit(env.KV, "post", user.id, perms.postsPerHour, 3600);
    if (!rl.allowed)
      return {
        error: `Post limit reached. You can post ${perms.postsPerHour} times per hour in this community.`,
      };
  }

  const form = await request.formData();
  const title = (form.get("title") as string | null)?.trim() ?? "";
  const body = (form.get("body") as string | null)?.trim() ?? "";
  const url = (form.get("url") as string | null)?.trim() ?? "";
  const mediaUrl = (form.get("mediaUrl") as string | null)?.trim() ?? "";
  const type = (form.get("type") as string | null) ?? "text";

  if (!title || title.length < 3) return { error: "Title must be at least 3 characters." };
  if (title.length > 300) return { error: "Title must be under 300 characters." };

  if (type === "link") {
    if (!perms.canPostLinks)
      return { error: "You don't have permission to post links in this community." };
    if (!url) return { error: "A URL is required for link posts." };
    try {
      new URL(url);
    } catch {
      return { error: "Enter a valid URL (include https://)." };
    }
  }
  if (type === "image") {
    if (!perms.canPostImages)
      return { error: "You don't have permission to post images in this community." };
    if (!mediaUrl) return { error: "Please upload an image before posting." };
  }
  if (type === "video") {
    if (!perms.canPostVideos)
      return { error: "You don't have permission to post videos in this community." };
    if (!mediaUrl) return { error: "Please upload a video before posting." };
  }

  let section = await db.query.communitySections.findFirst({
    where: and(
      eq(communitySections.communityId, community.id),
      eq(communitySections.slug, "general"),
    ),
    columns: { id: true },
  });

  if (!section) {
    const sectionId = generateId();
    const now = new Date();
    await db.insert(communitySections).values({
      id: sectionId,
      communityId: community.id,
      slug: "general",
      name: "General",
      position: 0,
      createdAt: now,
    });
    section = { id: sectionId };
  }

  const embed = type === "link" && url ? parseEmbed(url) : null;
  const postId = generateId();
  const now = new Date();

  const postType =
    type === "link" ? "link" : type === "image" ? "image" : type === "video" ? "video" : "text";
  const postUrl = type === "link" ? url : type === "image" || type === "video" ? mediaUrl : null;

  await db.insert(posts).values({
    id: postId,
    communityId: community.id,
    sectionId: section.id,
    authorId: user.id,
    type: postType,
    title,
    body: body || null,
    url: postUrl,
    embedKind: embed?.kind ?? null,
    embedRef: embed?.ref ?? null,
    score: 0,
    upvotes: 0,
    downvotes: 0,
    commentCount: 0,
    isPinned: false,
    isFeatured: false,
    createdAt: now,
    updatedAt: now,
  });

  return redirect(`/c/${community.slug}/p/${postId}`);
}

type Tab = "text" | "link" | "image" | "video";

type TiptapEditorType = React.ComponentType<{
  onChange: (html: string) => void;
  placeholder?: string;
}>;

function MediaUpload({
  accept,
  maxMB,
  label,
  hint,
  onUpload,
}: {
  accept: string;
  maxMB: number;
  label: string;
  hint: string;
  onUpload: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file.size > maxMB * 1024 * 1024) {
      setError(`File too large. Max ${maxMB} MB.`);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/media", { method: "POST", body: fd });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Upload failed. Please try again.");
        return;
      }
      setUploadedUrl(data.url);
      onUpload(data.url);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  if (uploadedUrl) {
    const isVideo = uploadedUrl.includes("/videos/");
    return (
      <div className="flex flex-col gap-2">
        <div
          className="rounded-md overflow-hidden"
          style={{ background: "var(--color-bg-elev-2)", border: "1px solid var(--color-border)" }}
        >
          {isVideo ? (
            // biome-ignore lint/a11y/useMediaCaption: user-uploaded clips, no caption track available
            <video
              src={uploadedUrl}
              controls
              className="w-full"
              style={{ maxHeight: "360px", display: "block" }}
            />
          ) : (
            <img
              src={uploadedUrl}
              alt="Preview"
              className="w-full object-contain"
              style={{ maxHeight: "360px" }}
            />
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setUploadedUrl(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
          className="text-xs self-start"
          style={{ color: "var(--color-text-faint)" }}
        >
          Remove &amp; upload different {label.toLowerCase()}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className="w-full rounded-md p-8 text-center transition-colors"
        style={{
          background: dragOver ? "var(--color-bg-elev-1)" : "var(--color-bg-elev-2)",
          border: `1px dashed ${dragOver ? "var(--color-text-faint)" : "var(--color-border)"}`,
          cursor: uploading ? "wait" : "pointer",
        }}
      >
        {uploading ? (
          <p className="text-sm" style={{ color: "var(--color-text-dim)" }}>
            Uploading…
          </p>
        ) : (
          <>
            <p className="text-sm font-medium mb-1" style={{ color: "var(--color-text-dim)" }}>
              Click or drag &amp; drop your {label.toLowerCase()}
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
              {hint}
            </p>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={onInputChange}
      />
      {error && (
        <p className="text-xs" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

export default function Submit() {
  const { slug, perms } = useLoaderData<typeof loader>();
  const data = useActionData<typeof action>();
  const nav = useNavigation();

  const [tab, setTab] = useState<Tab>("text");
  const [bodyHtml, setBodyHtml] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [EditorComp, setEditorComp] = useState<TiptapEditorType | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    import("~/components/editor/TiptapEditor").then((m) => {
      setEditorComp(() => m.TiptapEditor);
    });
  }, []);

  // Reset media URL when switching tabs
  const handleTabChange = (t: Tab) => {
    setTab(t);
    setMediaUrl("");
  };

  const tabs: { id: Tab; label: string; locked?: boolean }[] = [
    { id: "text", label: "Text" },
    { id: "link", label: "Link", locked: !perms.canPostLinks },
    { id: "image", label: "Image", locked: !perms.canPostImages },
    { id: "video", label: "Video", locked: !perms.canPostVideos },
  ];

  const submitDisabled =
    nav.state === "submitting" || ((tab === "image" || tab === "video") && !mediaUrl);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "var(--color-bg)" }}
    >
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <Link
            to={`/c/${slug}`}
            className="text-sm no-underline hover:underline"
            style={{ color: "var(--color-text-dim)" }}
          >
            ← c/{slug}
          </Link>
          <span style={{ color: "var(--color-border)" }}>·</span>
          <span className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
            Submit a post
          </span>
        </div>

        {data?.error && (
          <Alert variant="error" className="mb-4">
            {data.error}
          </Alert>
        )}

        <div
          className="rounded-lg overflow-hidden"
          style={{
            background: "var(--color-bg-elev-1)",
            border: "1px solid var(--color-border)",
          }}
        >
          {/* Tab bar */}
          <div className="flex" style={{ borderBottom: "1px solid var(--color-border)" }}>
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={t.locked}
                onClick={() => !t.locked && handleTabChange(t.id)}
                className="px-5 py-3 text-sm font-medium transition-colors relative"
                style={{
                  color: t.locked
                    ? "var(--color-text-faint)"
                    : tab === t.id
                      ? "var(--color-text)"
                      : "var(--color-text-dim)",
                  background: "transparent",
                  cursor: t.locked ? "not-allowed" : "pointer",
                  borderBottom:
                    tab === t.id ? "2px solid var(--color-text)" : "2px solid transparent",
                }}
              >
                {t.label}
                {t.locked && (
                  <span className="ml-1.5 text-xs" style={{ color: "var(--color-text-faint)" }}>
                    locked
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Form */}
          <Form method="post" className="p-6 flex flex-col gap-4">
            <input type="hidden" name="type" value={tab} />
            {(tab === "image" || tab === "video") && (
              <input type="hidden" name="mediaUrl" value={mediaUrl} />
            )}

            <Input
              ref={titleRef}
              id="title"
              name="title"
              type="text"
              label="Title"
              placeholder="Give your post a descriptive title"
              required
            />

            {tab === "text" && (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="body"
                  className="text-sm font-medium"
                  style={{ color: "var(--color-text)" }}
                >
                  Body <span style={{ color: "var(--color-text-faint)" }}>(optional)</span>
                </label>
                {EditorComp ? (
                  <>
                    <input type="hidden" name="body" value={bodyHtml} />
                    <EditorComp
                      onChange={setBodyHtml}
                      placeholder="Add more context, share your thoughts…"
                    />
                  </>
                ) : (
                  <textarea
                    id="body"
                    name="body"
                    placeholder="Add more context, share your thoughts…"
                    rows={6}
                    className="w-full rounded-md px-3 py-2.5 text-sm resize-y"
                    style={{
                      background: "var(--color-bg-elev-2)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                      outline: "none",
                      minHeight: "120px",
                    }}
                  />
                )}
              </div>
            )}

            {tab === "link" && (
              <>
                <Input
                  id="url"
                  name="url"
                  type="url"
                  label="URL"
                  placeholder="https://…"
                  hint="Paste a YouTube, Twitch, or any link. Supported videos will embed automatically."
                  required
                />
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="caption"
                    className="text-sm font-medium"
                    style={{ color: "var(--color-text)" }}
                  >
                    Caption <span style={{ color: "var(--color-text-faint)" }}>(optional)</span>
                  </label>
                  <textarea
                    id="caption"
                    name="body"
                    placeholder="Add a caption or context…"
                    rows={3}
                    className="w-full rounded-md px-3 py-2.5 text-sm resize-none"
                    style={{
                      background: "var(--color-bg-elev-2)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                      outline: "none",
                    }}
                  />
                </div>
              </>
            )}

            {tab === "image" && (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                  Image
                </span>
                <MediaUpload
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  maxMB={10}
                  label="Image"
                  hint="JPG, PNG, WebP, or GIF — max 10 MB"
                  onUpload={setMediaUrl}
                />
              </div>
            )}

            {tab === "video" && (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                  Video
                </span>
                <MediaUpload
                  accept="video/mp4,video/webm,video/quicktime"
                  maxMB={100}
                  label="Video"
                  hint="MP4, WebM, or MOV — max 100 MB"
                  onUpload={setMediaUrl}
                />
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button type="submit" loading={nav.state === "submitting"} disabled={submitDisabled}>
                {nav.state === "submitting" ? "Posting…" : "Post"}
              </Button>
              <Link
                to={`/c/${slug}`}
                className="px-4 py-2 text-sm rounded-md no-underline flex items-center"
                style={{
                  color: "var(--color-text-dim)",
                  border: "1px solid var(--color-border)",
                }}
              >
                Cancel
              </Link>
            </div>
          </Form>
        </div>

        {perms.postsPerHour > 0 && (
          <p className="text-xs mt-3 text-center" style={{ color: "var(--color-text-faint)" }}>
            Post limit: {perms.postsPerHour} per hour in this community
          </p>
        )}
      </div>
    </div>
  );
}
