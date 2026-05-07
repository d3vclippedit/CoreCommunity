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

  // Rate limit: 0 = unlimited
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
  if (type === "image" && !perms.canPostImages) {
    return { error: "You don't have permission to post images in this community." };
  }
  if (type === "video" && !perms.canPostVideos) {
    return { error: "You don't have permission to post videos in this community." };
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

  await db.insert(posts).values({
    id: postId,
    communityId: community.id,
    sectionId: section.id,
    authorId: user.id,
    type: type === "link" ? "link" : "text",
    title,
    body: body || null,
    url: type === "link" ? url : null,
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

type Tab = "text" | "link" | "image";

type TiptapEditorType = React.ComponentType<{
  onChange: (html: string) => void;
  placeholder?: string;
}>;

export default function Submit() {
  const { slug, perms } = useLoaderData<typeof loader>();
  const data = useActionData<typeof action>();
  const nav = useNavigation();

  const [tab, setTab] = useState<Tab>("text");
  const [bodyHtml, setBodyHtml] = useState("");
  const [EditorComp, setEditorComp] = useState<TiptapEditorType | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    import("~/components/editor/TiptapEditor").then((m) => {
      setEditorComp(() => m.TiptapEditor);
    });
  }, []);

  const tabs: { id: Tab; label: string; locked?: boolean; soon?: boolean }[] = [
    { id: "text", label: "Text" },
    { id: "link", label: "Link", locked: !perms.canPostLinks },
    { id: "image", label: "Image", soon: true },
  ];

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
            {tabs.map((t) => {
              const disabled = t.locked || t.soon;
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => !disabled && setTab(t.id)}
                  className="px-5 py-3 text-sm font-medium transition-colors relative"
                  style={{
                    color: disabled
                      ? "var(--color-text-faint)"
                      : tab === t.id
                        ? "var(--color-text)"
                        : "var(--color-text-dim)",
                    background: "transparent",
                    cursor: disabled ? "not-allowed" : "pointer",
                    borderBottom:
                      tab === t.id ? "2px solid var(--color-text)" : "2px solid transparent",
                  }}
                >
                  {t.label}
                  {t.soon && (
                    <span className="ml-1.5 text-xs" style={{ color: "var(--color-text-faint)" }}>
                      soon
                    </span>
                  )}
                  {t.locked && !t.soon && (
                    <span className="ml-1.5 text-xs" style={{ color: "var(--color-text-faint)" }}>
                      locked
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Form */}
          <Form method="post" className="p-6 flex flex-col gap-4">
            <input type="hidden" name="type" value={tab} />

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
              <div
                className="rounded-md p-8 text-center"
                style={{
                  background: "var(--color-bg-elev-2)",
                  border: "1px dashed var(--color-border)",
                }}
              >
                <p className="text-sm" style={{ color: "var(--color-text-faint)" }}>
                  Image uploads coming soon
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button type="submit" loading={nav.state === "submitting"} disabled={tab === "image"}>
                Post
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
