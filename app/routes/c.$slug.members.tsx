import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Link, useLoaderData } from "@remix-run/react";
import { and, eq, isNull } from "drizzle-orm";
import { Avatar } from "~/components/layout/Header";
import { createDb } from "~/lib/db/index";
import { communities, communityMemberships, users } from "../../db/schema";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data ? `Members of c/${data.slug} — CORE` : "CORE" },
];

export async function loader({ params, context }: LoaderFunctionArgs) {
  const db = createDb(context.cloudflare.env.DB);
  const community = await db.query.communities.findFirst({
    where: and(eq(communities.slug, params.slug ?? ""), isNull(communities.deletedAt)),
    columns: { id: true, slug: true },
  });
  if (!community) throw new Response("Community not found", { status: 404 });

  const members = await db
    .select({
      userId: communityMemberships.userId,
      role: communityMemberships.role,
      joinedAt: communityMemberships.joinedAt,
      handle: users.handle,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      isVerifiedStreamer: users.isVerifiedStreamer,
    })
    .from(communityMemberships)
    .innerJoin(users, eq(communityMemberships.userId, users.id))
    .where(eq(communityMemberships.communityId, community.id))
    .limit(100);

  // Sort: admin > senior_mod > mod > member
  const roleOrder: Record<string, number> = { admin: 0, senior_mod: 1, mod: 2, member: 3 };
  members.sort((a, b) => (roleOrder[a.role] ?? 4) - (roleOrder[b.role] ?? 4));

  return { slug: community.slug, members };
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin: { label: "Admin", color: "var(--color-danger)" },
  senior_mod: { label: "Senior Mod", color: "var(--color-text-dim)" },
  mod: { label: "Mod", color: "var(--color-text-dim)" },
  member: { label: "", color: "" },
};

export default function CommunityMembers() {
  const { members } = useLoaderData<typeof loader>();

  return (
    <div className="flex flex-col gap-3 py-4">
      <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
        Members ({members.length})
      </h2>

      <div
        className="rounded-lg overflow-hidden"
        style={{ border: "1px solid var(--color-border)" }}
      >
        {members.map((m, i) => {
          const badge = ROLE_LABELS[m.role];
          return (
            <div
              key={m.userId}
              className="flex items-center gap-3 px-4 py-3"
              style={{
                background: "var(--color-bg-elev-1)",
                borderTop: i > 0 ? "1px solid var(--color-border)" : undefined,
              }}
            >
              <Avatar displayName={m.displayName} avatarUrl={m.avatarUrl} size={32} />
              <div className="flex-1 min-w-0">
                <Link
                  to={`/u/${m.handle}`}
                  className="text-sm font-medium no-underline hover:underline"
                  style={{ color: "var(--color-text)" }}
                >
                  {m.displayName}
                </Link>
                <span className="text-xs ml-1.5" style={{ color: "var(--color-text-faint)" }}>
                  @{m.handle}
                </span>
                {m.isVerifiedStreamer && (
                  <span
                    className="ml-1.5 text-xs"
                    style={{ color: "var(--color-text-dim)" }}
                    title="Verified streamer"
                  >
                    ✓
                  </span>
                )}
              </div>
              {badge?.label && (
                <span className="text-xs font-medium" style={{ color: badge.color }}>
                  {badge.label}
                </span>
              )}
            </div>
          );
        })}

        {members.length === 0 && (
          <div className="p-6 text-center" style={{ background: "var(--color-bg-elev-1)" }}>
            <p className="text-sm" style={{ color: "var(--color-text-faint)" }}>
              No members yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
