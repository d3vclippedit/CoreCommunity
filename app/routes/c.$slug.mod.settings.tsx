import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  useRouteLoaderData,
} from "@remix-run/react";
import { and, eq, isNull } from "drizzle-orm";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { Alert } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { getCurrentUser, requireUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { canManageRules } from "~/lib/permissions";
import type { loader as rootLoader } from "~/root";
import { communities, communityMemberships } from "../../db/schema";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data ? `Settings — c/${data.community.slug}` : "CORE" },
];

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const user = requireUser(await getCurrentUser(request, env));
  const db = createDb(env.DB);

  const community = await db.query.communities.findFirst({
    where: and(eq(communities.slug, params.slug ?? ""), isNull(communities.deletedAt)),
  });
  if (!community) throw new Response("Community not found", { status: 404 });

  const membership = await db.query.communityMemberships.findFirst({
    where: and(
      eq(communityMemberships.userId, user.id),
      eq(communityMemberships.communityId, community.id),
    ),
    columns: { role: true },
  });

  if (!canManageRules(membership?.role) && !user.isPlatformAdmin) {
    throw new Response("Forbidden", { status: 403 });
  }

  return { community };
}

export async function action({ params, request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const user = requireUser(await getCurrentUser(request, env));
  const db = createDb(env.DB);

  const community = await db.query.communities.findFirst({
    where: and(eq(communities.slug, params.slug ?? ""), isNull(communities.deletedAt)),
    columns: { id: true, slug: true },
  });
  if (!community) throw new Response("Community not found", { status: 404 });

  const membership = await db.query.communityMemberships.findFirst({
    where: and(
      eq(communityMemberships.userId, user.id),
      eq(communityMemberships.communityId, community.id),
    ),
    columns: { role: true },
  });

  if (!canManageRules(membership?.role) && !user.isPlatformAdmin) {
    throw new Response("Forbidden", { status: 403 });
  }

  const form = await request.formData();
  const name = (form.get("name") as string | null)?.trim() ?? "";
  const description = (form.get("description") as string | null)?.trim() ?? "";
  const rules = (form.get("rules") as string | null)?.trim() ?? "";

  if (!name || name.length < 2 || name.length > 64) {
    return { error: "Name must be between 2 and 64 characters." };
  }

  // Parse rules as JSON array of strings (one per line)
  const rulesArray = rules
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean);

  await db
    .update(communities)
    .set({
      name,
      description: description || null,
      rules: rulesArray.length ? JSON.stringify(rulesArray) : null,
      updatedAt: new Date(),
    })
    .where(eq(communities.id, community.id));

  return { ok: true };
}

export default function ModSettings() {
  const { community } = useLoaderData<typeof loader>();
  const data = useActionData<typeof action>();
  const nav = useNavigation();
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const user = root?.user ?? null;

  const existingRules: string[] = (() => {
    try {
      return community.rules ? JSON.parse(community.rules) : [];
    } catch {
      return [];
    }
  })();

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header user={user} />
      <AppShell>
        <div className="py-6 max-w-xl">
          <div className="flex items-center gap-4 mb-6">
            <Link
              to={`/c/${community.slug}`}
              className="text-sm no-underline hover:underline"
              style={{ color: "var(--color-text-dim)" }}
            >
              ← c/{community.slug}
            </Link>
            <h1 className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>
              Community settings
            </h1>
          </div>

          {data && "ok" in data && data.ok && (
            <Alert variant="success" className="mb-4">
              Settings saved.
            </Alert>
          )}
          {data && "error" in data && data.error && (
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
                id="name"
                name="name"
                type="text"
                label="Display name"
                defaultValue={community.name}
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
                  defaultValue={community.description ?? ""}
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
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="rules"
                  className="text-sm font-medium"
                  style={{ color: "var(--color-text)" }}
                >
                  Rules
                </label>
                <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                  One rule per line.
                </p>
                <textarea
                  id="rules"
                  name="rules"
                  defaultValue={existingRules.join("\n")}
                  rows={5}
                  className="w-full rounded-md px-3 py-2 text-sm resize-y font-mono"
                  style={{
                    background: "var(--color-bg-elev-2)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                    outline: "none",
                  }}
                />
              </div>
              <Button type="submit" loading={nav.state === "submitting"} className="w-full">
                Save settings
              </Button>
            </Form>
          </div>
        </div>
      </AppShell>
      <Footer />
    </div>
  );
}
