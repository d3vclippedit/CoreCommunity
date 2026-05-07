import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Link, useFetcher, useLoaderData, useRouteLoaderData } from "@remix-run/react";
import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import type { loader as rootLoader } from "~/root";
import { badges, communities, communityMemberships, posts } from "../../db/schema";

export const meta: MetaFunction = () => [
  { title: "Communities — CORE" },
  { name: "description", content: "Browse all creator communities on CORE." },
  { property: "og:title", content: "Communities — CORE" },
  { property: "og:description", content: "Browse all creator communities on CORE." },
  { property: "og:type", content: "website" },
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
      tagline: communities.tagline,
      description: communities.description,
      iconUrl: communities.iconUrl,
      bannerUrl: communities.bannerUrl,
      accentColor: communities.accentColor,
      memberCount: communities.memberCount,
      isVerified: communities.isVerified,
    })
    .from(communities)
    .where(isNull(communities.deletedAt))
    .orderBy(desc(communities.memberCount))
    .limit(50);

  let joinedIds: Set<string> = new Set();
  if (user) {
    const memberships = await db
      .select({ communityId: communityMemberships.communityId })
      .from(communityMemberships)
      .where(eq(communityMemberships.userId, user.id));
    joinedIds = new Set(memberships.map((m) => m.communityId));
  }

  // Fetch post stats and badge counts in parallel for all fetched communities
  const communityIds = rows.map((r) => r.id);
  let postStatsMap = new Map<
    string,
    { postCount: number; imageCount: number; videoCount: number }
  >();
  let badgeCountMap = new Map<string, number>();

  if (communityIds.length > 0) {
    const [postStatRows, badgeCountRows] = await Promise.all([
      db
        .select({
          communityId: posts.communityId,
          postCount: sql<number>`count(*)`,
          imageCount: sql<number>`coalesce(sum(case when ${posts.type} = 'image' then 1 else 0 end), 0)`,
          videoCount: sql<number>`coalesce(sum(case when ${posts.type} = 'video' then 1 else 0 end), 0)`,
        })
        .from(posts)
        .where(and(isNull(posts.removedAt), inArray(posts.communityId, communityIds)))
        .groupBy(posts.communityId),
      db
        .select({
          communityId: badges.communityId,
          count: sql<number>`count(*)`,
        })
        .from(badges)
        .where(
          and(
            eq(badges.scope, "community"),
            isNotNull(badges.communityId),
            inArray(badges.communityId, communityIds),
          ),
        )
        .groupBy(badges.communityId),
    ]);

    postStatsMap = new Map(
      postStatRows.map((s) => [
        s.communityId,
        { postCount: s.postCount, imageCount: s.imageCount, videoCount: s.videoCount },
      ]),
    );
    badgeCountMap = new Map(badgeCountRows.map((b) => [b.communityId as string, b.count]));
  }

  const enriched = rows.map((c) => {
    const ps = postStatsMap.get(c.id);
    return {
      ...c,
      postCount: ps?.postCount ?? 0,
      imageCount: ps?.imageCount ?? 0,
      videoCount: ps?.videoCount ?? 0,
      badgeCount: badgeCountMap.get(c.id) ?? 0,
    };
  });

  return { communities: enriched, joinedIds: [...joinedIds] };
}

export default function CommunitiesIndex() {
  const { communities: rows, joinedIds } = useLoaderData<typeof loader>();
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const user = root?.user ?? null;
  const joinedSet = new Set(joinedIds);

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
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(245px, 1fr))" }}
            >
              {rows.map((c) => (
                <CommunityCard
                  key={c.id}
                  community={c}
                  isJoined={joinedSet.has(c.id)}
                  user={user}
                />
              ))}
            </div>
          )}
        </div>
      </AppShell>
      <Footer />
    </div>
  );
}

type Community = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  iconUrl: string | null;
  bannerUrl: string | null;
  accentColor: string | null;
  memberCount: number;
  isVerified: boolean;
  postCount: number;
  imageCount: number;
  videoCount: number;
  badgeCount: number;
};

function CommunityCard({
  community: c,
  isJoined,
  user,
}: {
  community: Community;
  isJoined: boolean;
  user: { id: string } | null;
}) {
  const fetcher = useFetcher();
  const pending = fetcher.state !== "idle";
  const accent = c.accentColor ?? null;

  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl"
      style={{
        height: "329px",
        background: accent ? `${accent}12` : "var(--color-bg-elev-1)",
        border: `1px solid ${accent ? `${accent}40` : "var(--color-border)"}`,
      }}
    >
      {/* ── Hero image (top half) ── */}
      <Link
        to={`/c/${c.slug}`}
        className="block relative flex-shrink-0"
        style={{ height: "145px" }}
      >
        {c.bannerUrl ? (
          <img src={c.bannerUrl} alt="" aria-hidden="true" className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: accent
                ? `linear-gradient(160deg, ${accent}55 0%, ${accent}22 60%, var(--color-bg-elev-2) 100%)`
                : "linear-gradient(160deg, var(--color-bg-elev-2) 0%, var(--color-bg) 100%)",
            }}
          />
        )}

        {/* Verified badge */}
        {c.isVerified && (
          <div
            className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded-full font-medium"
            style={{
              background: "rgba(10,10,12,0.80)",
              color: "var(--color-success)",
              backdropFilter: "blur(4px)",
              border: "1px solid var(--color-success)",
            }}
          >
            ✓
          </div>
        )}

        {/* Avatar overlapping bottom of hero */}
        <div className="absolute" style={{ bottom: "-18px", left: "12px" }}>
          <CommunityAvatar name={c.name} iconUrl={c.iconUrl} size={40} accentColor={accent} />
        </div>
      </Link>

      {/* ── Identity row ── */}
      <div className="px-3 pt-6 pb-2">
        <Link to={`/c/${c.slug}`} className="no-underline block">
          <p
            className="text-sm font-semibold leading-tight truncate"
            style={{ color: "var(--color-text)" }}
          >
            {c.name}
          </p>
          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--color-text-faint)" }}>
            c/{c.slug}
          </p>
        </Link>
      </div>

      {/* ── Stats grid ── */}
      <div
        className="mx-3 rounded-lg px-3 py-2.5"
        style={{
          background: accent ? `${accent}10` : "var(--color-bg-elev-2)",
          border: `1px solid ${accent ? `${accent}25` : "var(--color-border)"}`,
        }}
      >
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {[
            { label: "Members", value: formatCount(c.memberCount) },
            { label: "Badges", value: c.badgeCount > 0 ? String(c.badgeCount) : "—" },
            { label: "Posts", value: formatCount(c.postCount) },
            { label: "Images", value: formatCount(c.imageCount) },
            { label: "Videos", value: formatCount(c.videoCount) },
            { label: "Live", value: "—" },
          ].map(({ label, value }) => (
            <div key={label}>
              <p
                className="text-[9px] uppercase tracking-wider font-medium"
                style={{ color: "var(--color-text-faint)" }}
              >
                {label}
              </p>
              <p
                className="text-xs font-semibold leading-tight"
                style={{ color: accent ?? "var(--color-text)" }}
              >
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Join / Joined button ── */}
      <div className="mt-auto px-3 pb-3 pt-2">
        {user ? (
          <fetcher.Form method="post" action={`/c/${c.slug}/join`}>
            <input type="hidden" name="communityId" value={c.id} />
            <input type="hidden" name="action" value={isJoined ? "leave" : "join"} />
            <button
              type="submit"
              disabled={pending}
              className="w-full py-1.5 text-xs font-semibold rounded-lg transition-opacity disabled:opacity-50"
              style={
                isJoined
                  ? {
                      background: "var(--color-bg-elev-2)",
                      color: "var(--color-text-dim)",
                      border: "1px solid var(--color-border)",
                    }
                  : {
                      background: accent ?? "var(--color-text)",
                      color: accent ? "#fff" : "var(--color-bg)",
                    }
              }
            >
              {pending ? "…" : isJoined ? "Joined ✓" : "Join community"}
            </button>
          </fetcher.Form>
        ) : (
          <Link
            to="/auth/signup"
            className="block w-full py-1.5 text-xs font-semibold rounded-lg text-center no-underline"
            style={{ background: "var(--color-text)", color: "var(--color-bg)" }}
          >
            Join community
          </Link>
        )}
      </div>
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function CommunityAvatar({
  name,
  iconUrl,
  size = 32,
  accentColor,
}: {
  name: string;
  iconUrl: string | null;
  size?: number;
  accentColor?: string | null;
}) {
  const initials = name.slice(0, 2).toUpperCase();
  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover flex-shrink-0"
        style={{
          width: size,
          height: size,
          border: `2px solid ${accentColor ?? "var(--color-border)"}`,
        }}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center rounded-full flex-shrink-0 font-semibold select-none"
      style={{
        width: size,
        height: size,
        background: accentColor ? `${accentColor}33` : "var(--color-bg-elev-2)",
        border: `2px solid ${accentColor ?? "var(--color-border)"}`,
        color: accentColor ?? "var(--color-text-dim)",
        fontSize: size < 30 ? "10px" : "12px",
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
