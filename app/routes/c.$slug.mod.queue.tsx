import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Form, Link, useLoaderData, useRouteLoaderData } from "@remix-run/react";
import { and, eq, isNull } from "drizzle-orm";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { getCurrentUser, requireUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { isStaff } from "~/lib/permissions";
import type { loader as rootLoader } from "~/root";
import { communities, communityMemberships, reports, users } from "../../db/schema";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data ? `Mod queue — c/${data.slug}` : "Cormunities" },
];

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const user = requireUser(await getCurrentUser(request, env));

  const db = createDb(env.DB);
  const community = await db.query.communities.findFirst({
    where: and(eq(communities.slug, params.slug ?? ""), isNull(communities.deletedAt)),
    columns: { id: true, slug: true, name: true },
  });
  if (!community) throw new Response("Community not found", { status: 404 });

  const membership = await db.query.communityMemberships.findFirst({
    where: and(
      eq(communityMemberships.userId, user.id),
      eq(communityMemberships.communityId, community.id),
    ),
    columns: { role: true },
  });

  if (!isStaff(membership?.role) && !user.isPlatformAdmin) {
    throw new Response("Forbidden", { status: 403 });
  }

  const openReports = await db
    .select({
      id: reports.id,
      targetType: reports.targetType,
      targetId: reports.targetId,
      reason: reports.reason,
      details: reports.details,
      createdAt: reports.createdAt,
      reporterHandle: users.handle,
    })
    .from(reports)
    .innerJoin(users, eq(reports.reporterId, users.id))
    .where(and(eq(reports.communityId, community.id), eq(reports.status, "open")))
    .limit(50);

  return { slug: community.slug, name: community.name, reports: openReports };
}

export default function ModQueue() {
  const { slug, reports: openReports } = useLoaderData<typeof loader>();
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const user = root?.user ?? null;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header user={user} />
      <AppShell>
        <div className="py-6">
          <div className="flex items-center gap-4 mb-6">
            <Link
              to={`/c/${slug}`}
              className="text-sm no-underline hover:underline"
              style={{ color: "var(--color-text-dim)" }}
            >
              ← c/{slug}
            </Link>
            <h1 className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>
              Mod Queue
            </h1>
          </div>

          <div className="flex gap-3 mb-6 text-sm">
            <Link
              to={`/c/${slug}/mod/queue`}
              className="px-3 py-1.5 rounded-md no-underline font-medium"
              style={{ background: "var(--color-bg-elev-2)", color: "var(--color-text)" }}
            >
              Reports {openReports.length > 0 && `(${openReports.length})`}
            </Link>
            <Link
              to={`/c/${slug}/mod/settings`}
              className="px-3 py-1.5 rounded-md no-underline"
              style={{ color: "var(--color-text-dim)" }}
            >
              Settings
            </Link>
          </div>

          {openReports.length === 0 ? (
            <div
              className="rounded-lg p-8 text-center"
              style={{
                background: "var(--color-bg-elev-1)",
                border: "1px solid var(--color-border)",
              }}
            >
              <p className="text-sm" style={{ color: "var(--color-text-dim)" }}>
                Queue is clear. Nice work.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {openReports.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg p-4"
                  style={{
                    background: "var(--color-bg-elev-1)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-xs px-2 py-0.5 rounded capitalize"
                          style={{
                            background: "var(--color-bg-elev-2)",
                            color: "var(--color-text-dim)",
                          }}
                        >
                          {r.reason.replace("_", " ")}
                        </span>
                        <span
                          className="text-xs capitalize"
                          style={{ color: "var(--color-text-faint)" }}
                        >
                          {r.targetType}
                        </span>
                      </div>
                      {r.details && (
                        <p className="text-sm" style={{ color: "var(--color-text-dim)" }}>
                          "{r.details}"
                        </p>
                      )}
                      <p className="text-xs mt-1" style={{ color: "var(--color-text-faint)" }}>
                        Reported by @{r.reporterHandle} · {relativeTime(r.createdAt)}
                      </p>
                    </div>

                    <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                      <Link
                        to={r.targetType === "post" ? `/c/${slug}/p/${r.targetId}` : `/c/${slug}`}
                        className="px-3 py-1 text-xs rounded-md no-underline"
                        style={{
                          border: "1px solid var(--color-border)",
                          color: "var(--color-text-dim)",
                        }}
                      >
                        View
                      </Link>

                      {/* Remove content */}
                      <Form method="post" action="/api/remove">
                        <input type="hidden" name="targetType" value={r.targetType} />
                        <input type="hidden" name="targetId" value={r.targetId} />
                        <input type="hidden" name="communitySlug" value={slug} />
                        <input type="hidden" name="redirectTo" value={`/c/${slug}/mod/queue`} />
                        <button
                          type="submit"
                          className="px-3 py-1 text-xs rounded-md"
                          style={{
                            border: "1px solid var(--color-danger)",
                            color: "var(--color-danger)",
                          }}
                        >
                          Remove
                        </button>
                      </Form>

                      {/* Dismiss report */}
                      <Form method="post" action="/api/mod">
                        <input type="hidden" name="action" value="dismiss_report" />
                        <input type="hidden" name="reportId" value={r.id} />
                        <input type="hidden" name="communitySlug" value={slug} />
                        <input type="hidden" name="redirectTo" value={`/c/${slug}/mod/queue`} />
                        <button
                          type="submit"
                          className="px-3 py-1 text-xs rounded-md"
                          style={{
                            border: "1px solid var(--color-border)",
                            color: "var(--color-text-faint)",
                          }}
                        >
                          Dismiss
                        </button>
                      </Form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </AppShell>
      <Footer />
    </div>
  );
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
