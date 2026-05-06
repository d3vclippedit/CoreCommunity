import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Link, useLoaderData, useRouteLoaderData } from "@remix-run/react";
import { desc, eq, isNull } from "drizzle-orm";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import type { loader as rootLoader } from "~/root";
import { communities, communityMemberships } from "../../db/schema";

export const meta: MetaFunction = () => [
  { title: "Communities — CORE" },
  { name: "description", content: "Browse all creator communities on CORE." },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const db = createDb(env.DB);
  const user = await getCurrentUser(request, env);

  const rows = await db
    .select({
      id: communities.id,
      slug: communities.slug,
      name: communities.name,
      description: communities.description,
      iconUrl: communities.iconUrl,
      memberCount: communities.memberCount,
    })
    .from(communities)
    .where(isNull(communities.deletedAt))
    .orderBy(desc(communities.memberCount))
    .limit(50);

  let joinedSlugs: Set<string> = new Set();
  if (user) {
    const memberships = await db
      .select({ communityId: communityMemberships.communityId })
      .from(communityMemberships)
      .where(eq(communityMemberships.userId, user.id));
    const communityIds = new Set(memberships.map((m) => m.communityId));
    const joined = rows.filter((r) => communityIds.has(r.id));
    joinedSlugs = new Set(joined.map((r) => r.slug));
  }

  return { communities: rows, joinedSlugs: [...joinedSlugs] };
}

export default function CommunitiesIndex() {
  const { communities: rows, joinedSlugs } = useLoaderData<typeof loader>();
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const user = root?.user ?? null;
  const joinedSet = new Set(joinedSlugs);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header user={user} />
      <AppShell>
        <div className="py-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>
              Communities
            </h1>
            {user?.isPlatformAdmin && (
              <Link
                to="/communities/new"
                className="px-3 py-1.5 text-sm font-medium rounded-md no-underline"
                style={{ background: "var(--color-text)", color: "var(--color-bg)" }}
              >
                New community
              </Link>
            )}
          </div>

          {rows.length === 0 ? (
            <div
              className="rounded-lg p-8 text-center"
              style={{
                background: "var(--color-bg-elev-1)",
                border: "1px solid var(--color-border)",
              }}
            >
              <p className="text-sm" style={{ color: "var(--color-text-dim)" }}>
                No communities yet. Check back soon.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {rows.map((c) => (
                <Link
                  key={c.id}
                  to={`/c/${c.slug}`}
                  className="flex items-center gap-4 p-4 rounded-lg no-underline transition-colors hover:opacity-90"
                  style={{
                    background: "var(--color-bg-elev-1)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <CommunityAvatar name={c.name} iconUrl={c.iconUrl} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: "var(--color-text)" }}
                      >
                        c/{c.slug}
                      </span>
                      {joinedSet.has(c.slug) && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{
                            background: "var(--color-bg-elev-2)",
                            color: "var(--color-text-dim)",
                          }}
                        >
                          Joined
                        </span>
                      )}
                    </div>
                    <p
                      className="text-xs mt-0.5 truncate"
                      style={{ color: "var(--color-text-dim)" }}
                    >
                      {c.description || c.name}
                    </p>
                  </div>
                  <span
                    className="text-xs flex-shrink-0"
                    style={{ color: "var(--color-text-faint)" }}
                  >
                    {formatCount(c.memberCount)} members
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </AppShell>
      <Footer />
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function CommunityAvatar({
  name,
  iconUrl,
  size = 32,
}: { name: string; iconUrl: string | null; size?: number }) {
  const initials = name.slice(0, 2).toUpperCase();
  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size, border: "1px solid var(--color-border)" }}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center rounded-full flex-shrink-0 text-xs font-semibold select-none"
      style={{
        width: size,
        height: size,
        background: "var(--color-bg-elev-2)",
        border: "1px solid var(--color-border)",
        color: "var(--color-text-dim)",
        fontSize: size < 30 ? "10px" : "12px",
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
