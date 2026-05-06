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
import { Alert } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { checkRateLimit } from "~/lib/ratelimit";
import { generateId } from "~/lib/utils";
import { communities, communitySections, posts } from "../../db/schema";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data ? `Submit to c/${data.slug} — CORE` : "CORE" },
];

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) return redirect("/auth/login");

  const db = createDb(env.DB);
  const community = await db.query.communities.findFirst({
    where: and(eq(communities.slug, params.slug ?? ""), isNull(communities.deletedAt)),
    columns: { id: true, slug: true, name: true },
  });
  if (!community) throw new Response("Community not found", { status: 404 });

  return { slug: community.slug, name: community.name };
}

export async function action({ params, request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) return redirect("/auth/login");
  if (!user.emailVerifiedAt) return { error: "You must verify your email before posting." };

  const rl = await checkRateLimit(env.KV, "post", user.id, 10, 3600);
  if (!rl.allowed) return { error: "Too many posts. Try again later." };

  const db = createDb(env.DB);
  const community = await db.query.communities.findFirst({
    where: and(eq(communities.slug, params.slug ?? ""), isNull(communities.deletedAt)),
    columns: { id: true, slug: true },
  });
  if (!community) throw new Response("Community not found", { status: 404 });

  // Ensure the user is at least a member (or community is open)
  // For now allow any logged-in verified user

  const form = await request.formData();
  const title = (form.get("title") as string | null)?.trim() ?? "";
  const body = (form.get("body") as string | null)?.trim() ?? "";
  const type = (form.get("type") as string | null) ?? "text";

  if (!title || title.length < 3) return { error: "Title must be at least 3 characters." };
  if (title.length > 300) return { error: "Title must be under 300 characters." };

  // Get or create default "general" section for this community
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

export default function Submit() {
  const { slug } = useLoaderData<typeof loader>();
  const data = useActionData<typeof action>();
  const nav = useNavigation();

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
          className="rounded-lg p-6"
          style={{
            background: "var(--color-bg-elev-1)",
            border: "1px solid var(--color-border)",
          }}
        >
          <Form method="post" className="flex flex-col gap-4">
            <Input
              id="title"
              name="title"
              type="text"
              label="Title"
              placeholder="Give your post a descriptive title"
              required
            />
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="body"
                className="text-sm font-medium"
                style={{ color: "var(--color-text)" }}
              >
                Body <span style={{ color: "var(--color-text-faint)" }}>(optional)</span>
              </label>
              <textarea
                id="body"
                name="body"
                placeholder="Add more context, share your thoughts…"
                rows={6}
                className="w-full rounded-md px-3 py-2 text-sm resize-y"
                style={{
                  background: "var(--color-bg-elev-2)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                  outline: "none",
                  minHeight: "120px",
                }}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={nav.state === "submitting"}>
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
      </div>
    </div>
  );
}
