import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import {
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
  useRouteLoaderData,
} from "@remix-run/react";
import { eq } from "drizzle-orm";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { Alert } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { generateId } from "~/lib/utils";
import type { loader as rootLoader } from "~/root";
import { communities, communityMemberships } from "../../db/schema";

export const meta: MetaFunction = () => [{ title: "New community — Cormunities" }];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) return redirect("/auth/login");
  if (!user.isPlatformAdmin) throw new Response("Forbidden", { status: 403 });
  return null;
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user || !user.isPlatformAdmin) throw new Response("Forbidden", { status: 403 });

  const form = await request.formData();
  const slug = (form.get("slug") as string | null)?.trim().toLowerCase() ?? "";
  const name = (form.get("name") as string | null)?.trim() ?? "";
  const description = (form.get("description") as string | null)?.trim() ?? "";

  if (!slug || !/^[a-z0-9_]{2,32}$/.test(slug)) {
    return { error: "Slug must be 2–32 characters: lowercase letters, numbers, underscores." };
  }
  if (!name || name.length < 2 || name.length > 64) {
    return { error: "Name must be between 2 and 64 characters." };
  }

  const db = createDb(env.DB);
  const existing = await db.query.communities.findFirst({ where: eq(communities.slug, slug) });
  if (existing) return { error: "That slug is already taken." };

  const now = new Date();
  const communityId = generateId();
  await db.insert(communities).values({
    id: communityId,
    slug,
    name,
    description: description || null,
    ownerId: user.id,
    memberCount: 1,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(communityMemberships).values({
    userId: user.id,
    communityId,
    role: "admin",
    joinedAt: now,
    updatedAt: now,
  });

  return redirect(`/c/${slug}`);
}

export default function NewCommunity() {
  const data = useActionData<typeof action>();
  const nav = useNavigation();
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const user = root?.user ?? null;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header user={user} />
      <AppShell>
        <div className="py-8 max-w-lg">
          <h1 className="text-xl font-semibold mb-6" style={{ color: "var(--color-text)" }}>
            Create a community
          </h1>
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
                id="slug"
                name="slug"
                type="text"
                label="Slug (URL)"
                placeholder="my_community"
                hint="Lowercase letters, numbers, underscores. 2–32 chars. Cannot be changed."
                required
              />
              <Input
                id="name"
                name="name"
                type="text"
                label="Display name"
                placeholder="My Community"
                required
              />
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="description"
                  className="text-sm font-medium"
                  style={{ color: "var(--color-text)" }}
                >
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  placeholder="What is this community about?"
                  rows={3}
                  className="w-full rounded-md px-3 py-2 text-sm resize-none"
                  style={{
                    background: "var(--color-bg-elev-2)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                    outline: "none",
                  }}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" loading={nav.state === "submitting"}>
                  Create community
                </Button>
                <Link
                  to="/communities"
                  className="px-4 py-2 text-sm rounded-md no-underline"
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
      </AppShell>
      <Footer />
    </div>
  );
}
