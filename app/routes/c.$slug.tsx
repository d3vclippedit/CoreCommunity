import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import {
  Link,
  NavLink,
  Outlet,
  useFetcher,
  useLoaderData,
  useRouteLoaderData,
} from "@remix-run/react";
import { and, eq, isNull, ne } from "drizzle-orm";
import type React from "react";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";

import type { loader as rootLoader } from "~/root";
import { communities, communityMemberships, users } from "../../db/schema";
import { CommunityAvatar } from "./communities._index";

// Default role colors used when community hasn't customised them
const DEFAULT_ROLE_COLORS = {
  streamer: "#F59E0B",
  admin: "#A855F7",
  senior_mod: "#3B82F6",
  mod: "#22C55E",
} as const;

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const db = createDb(env.DB);
  const user = await getCurrentUser(request, env);

  const community = await db.query.communities.findFirst({
    where: and(eq(communities.slug, params.slug ?? ""), isNull(communities.deletedAt)),
  });

  if (!community) throw new Response("Community not found", { status: 404 });

  let membership = null;
  if (user) {
    membership = await db.query.communityMemberships.findFirst({
      where: and(
        eq(communityMemberships.userId, user.id),
        eq(communityMemberships.communityId, community.id),
      ),
      columns: { role: true },
    });
  }

  const staffRows = await db
    .select({
      userId: communityMemberships.userId,
      role: communityMemberships.role,
      handle: users.handle,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(communityMemberships)
    .innerJoin(users, eq(communityMemberships.userId, users.id))
    .where(
      and(
        eq(communityMemberships.communityId, community.id),
        ne(communityMemberships.role, "member"),
      ),
    );

  const ownerUser = await db.query.users.findFirst({
    where: eq(users.id, community.ownerId),
    columns: { id: true, handle: true, displayName: true, avatarUrl: true },
  });

  const host = new URL(request.url).hostname;

  return {
    community,
    membership: membership ?? null,
    staffRows,
    ownerUser: ownerUser ?? null,
    host,
    twitchChannel247: community.twitchChannel247 ?? null,
    borderStyles: {
      streamer: community.roleBorderStreamer ?? "electric",
      admin: community.roleBorderAdmin ?? "glow",
      senior_mod: community.roleBorderSeniorMod ?? "subtle",
      mod: community.roleBorderMod ?? "none",
    },
  };
}

export default function CommunityHub() {
  const { community, membership, staffRows, ownerUser, host, twitchChannel247, borderStyles } =
    useLoaderData<typeof loader>();
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const rootUser = root?.user ?? null;

  const isMod =
    membership?.role === "mod" || membership?.role === "senior_mod" || membership?.role === "admin";

  const twitchChannel = community.twitchChannel;

  const roleColors = {
    streamer: community.roleColorStreamer ?? DEFAULT_ROLE_COLORS.streamer,
    admin: community.roleColorAdmin ?? DEFAULT_ROLE_COLORS.admin,
    senior_mod: community.roleColorSeniorMod ?? DEFAULT_ROLE_COLORS.senior_mod,
    mod: community.roleColorMod ?? DEFAULT_ROLE_COLORS.mod,
  };

  const leftNav = (
    <nav className="flex flex-col gap-1" aria-label="Community navigation">
      <div className="mb-3">
        <div className="flex items-center gap-2.5 mb-1">
          <CommunityAvatar name={community.name} iconUrl={community.iconUrl} size={28} />
          <span className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
            {community.name}
          </span>
        </div>
        <p className="text-xs mt-1" style={{ color: "var(--color-text-faint)" }}>
          {community.memberCount.toLocaleString()} members
        </p>
      </div>

      <CommunityNavLink to={`/c/${community.slug}`} label="Posts" end />
      <CommunityNavLink to={`/c/${community.slug}/about`} label="About" />
      <CommunityNavLink to={`/c/${community.slug}/members`} label="Members" />

      {isMod && (
        <>
          <div
            className="my-2 border-t"
            style={{ borderColor: "var(--color-border)" }}
            aria-hidden="true"
          />
          <CommunityNavLink to={`/c/${community.slug}/mod/queue`} label="Mod queue" />
          <CommunityNavLink to={`/c/${community.slug}/mod/settings`} label="Settings" />
        </>
      )}

      <div className="mt-4">
        <JoinButton
          communityId={community.id}
          slug={community.slug}
          membership={membership}
          user={rootUser}
        />
      </div>

      {twitchChannel && (
        <div className="mt-4 flex flex-col gap-2">
          <p
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--color-text-faint)" }}
          >
            Live stream
          </p>
          <div
            className="rounded-md overflow-hidden"
            style={{ border: "1px solid var(--color-border)" }}
          >
            <div style={{ position: "relative", paddingTop: "56.25%" }}>
              <iframe
                src={`https://player.twitch.tv/?channel=${twitchChannel}&parent=${host}&muted=true`}
                title={`${community.name} live stream`}
                allowFullScreen
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  display: "block",
                }}
              />
            </div>
          </div>
          <p
            className="text-xs font-semibold uppercase tracking-wide mt-1"
            style={{ color: "var(--color-text-faint)" }}
          >
            Live chat
          </p>
          <div
            className="rounded-md overflow-hidden"
            style={{ border: "1px solid var(--color-border)" }}
          >
            <iframe
              src={`https://www.twitch.tv/embed/${twitchChannel}/chat?parent=${host}&darkpopout`}
              title={`${community.name} live chat`}
              width="100%"
              height="800"
              style={{ display: "block" }}
            />
          </div>
          {twitchChannel247 && (
            <p className="text-xs mt-1" style={{ color: "var(--color-text-faint)" }}>
              Also streaming 24/7 on{" "}
              <a
                href={`https://twitch.tv/${twitchChannel247}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--color-text-dim)" }}
              >
                /{twitchChannel247}
              </a>
            </p>
          )}
        </div>
      )}
    </nav>
  );

  const admins = staffRows.filter((s) => s.role === "admin");
  const seniorMods = staffRows.filter((s) => s.role === "senior_mod");
  const mods = staffRows.filter((s) => s.role === "mod");

  const rightRail = (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-lg p-4"
        style={{ background: "var(--color-bg-elev-1)", border: "1px solid var(--color-border)" }}
      >
        <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--color-text)" }}>
          {community.name}
        </h2>
        {(community.tagline || community.description) && (
          <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--color-text-dim)" }}>
            {community.tagline || community.description}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <div
            className="flex justify-between text-xs"
            style={{ color: "var(--color-text-faint)" }}
          >
            <span>Members</span>
            <span className="font-medium" style={{ color: "var(--color-text)" }}>
              {community.memberCount.toLocaleString()}
            </span>
          </div>
        </div>
        {community.bannerUrl && (
          <img
            src={community.bannerUrl}
            alt=""
            aria-hidden="true"
            className="w-full rounded-md mt-3 object-cover"
            style={{ height: "80px" }}
          />
        )}
      </div>

      <div
        className="rounded-lg p-4"
        style={{ background: "var(--color-bg-elev-1)", border: "1px solid var(--color-border)" }}
      >
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text)" }}>
          Staff
        </h2>

        {ownerUser && (
          <MemberSection label="Streamer / Owner" color={roleColors.streamer}>
            <MemberRow
              handle={ownerUser.handle}
              displayName={ownerUser.displayName}
              avatarUrl={ownerUser.avatarUrl}
              roleColor={roleColors.streamer}
              borderStyle={borderStyles.streamer}
            />
          </MemberSection>
        )}

        {admins.length > 0 && (
          <MemberSection label="Admins" color={roleColors.admin}>
            {admins.map((m) => (
              <MemberRow
                key={m.userId}
                handle={m.handle}
                displayName={m.displayName}
                avatarUrl={m.avatarUrl}
                roleColor={roleColors.admin}
                borderStyle={borderStyles.admin}
              />
            ))}
          </MemberSection>
        )}

        {seniorMods.length > 0 && (
          <MemberSection label="Senior Mods" color={roleColors.senior_mod}>
            {seniorMods.map((m) => (
              <MemberRow
                key={m.userId}
                handle={m.handle}
                displayName={m.displayName}
                avatarUrl={m.avatarUrl}
                roleColor={roleColors.senior_mod}
                borderStyle={borderStyles.senior_mod}
              />
            ))}
          </MemberSection>
        )}

        {mods.length > 0 && (
          <MemberSection label="Mods" color={roleColors.mod}>
            {mods.map((m) => (
              <MemberRow
                key={m.userId}
                handle={m.handle}
                displayName={m.displayName}
                avatarUrl={m.avatarUrl}
                roleColor={roleColors.mod}
                borderStyle={borderStyles.mod}
              />
            ))}
          </MemberSection>
        )}

        <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--color-border)" }}>
          <div
            className="flex justify-between text-xs"
            style={{ color: "var(--color-text-faint)" }}
          >
            <span>All members</span>
            <Link
              to={`/c/${community.slug}/members`}
              className="no-underline hover:underline"
              style={{ color: "var(--color-text-faint)" }}
            >
              {community.memberCount.toLocaleString()} total →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={
        {
          background: community.backgroundCss ?? "var(--color-bg)",
          ...(community.accentColor ? { "--color-accent": community.accentColor } : {}),
        } as React.CSSProperties
      }
    >
      <Header user={rootUser} />
      <AppShell leftNav={leftNav} rightRail={rightRail} transparent className="flex-1 min-h-0">
        <Outlet />
      </AppShell>
      <Footer />
    </div>
  );
}

function MemberSection({
  label,
  color,
  children,
}: {
  label: string;
  color?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        {color && (
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
        )}
        <p
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--color-text-faint)" }}
        >
          {label}
        </p>
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

const BORDER_ANIMATIONS: Record<string, { animation: string; speed: string }> = {
  subtle: { animation: "subtle-glow", speed: "3s ease-in-out infinite" },
  glow: { animation: "glow-pulse", speed: "2s ease-in-out infinite" },
  pulse: { animation: "pulse-strong", speed: "2s ease-in-out infinite" },
  electric: { animation: "electric-border", speed: "0.8s ease-in-out infinite" },
  fire: { animation: "fire-border", speed: "1.8s ease-in-out infinite" },
  frost: { animation: "frost-glow", speed: "2.5s ease-in-out infinite" },
  rainbow: { animation: "rainbow-glow", speed: "3s linear infinite" },
};

function getRoleBadgeStyle(
  borderStyle: string,
  roleColor: string | null | undefined,
  avatarUrl: string | null | undefined,
): React.CSSProperties {
  const base: React.CSSProperties = {
    background: avatarUrl ? undefined : "var(--color-bg-elev-2)",
    backgroundImage: avatarUrl ? `url(${avatarUrl})` : undefined,
    backgroundSize: avatarUrl ? "cover" : undefined,
    backgroundPosition: avatarUrl ? "center" : undefined,
    color: roleColor ?? "var(--color-text-dim)",
  };

  if (borderStyle === "rainbow") {
    return {
      ...base,
      border: "1.5px solid transparent",
      animation: "rainbow-glow 3s linear infinite",
    };
  }

  const anim = BORDER_ANIMATIONS[borderStyle];
  return {
    ...base,
    border: `1.5px solid ${roleColor ?? "var(--color-border)"}`,
    ...(anim && roleColor
      ? ({
          "--glow-color": `${roleColor}99`,
          animation: `${anim.animation} ${anim.speed}`,
        } as React.CSSProperties)
      : {}),
  };
}

function MemberRow({
  handle,
  displayName,
  avatarUrl,
  roleColor,
  borderStyle = "none",
}: {
  handle: string;
  displayName: string;
  avatarUrl: string | null | undefined;
  roleColor?: string | null;
  borderStyle?: string;
}) {
  return (
    <Link
      to={`/u/${handle}`}
      className="flex items-center gap-2 no-underline rounded-md px-1.5 py-1 transition-colors hover:bg-[var(--color-bg-elev-2)]"
    >
      <div
        className="w-6 h-6 flex-shrink-0 flex items-center justify-center text-xs font-semibold overflow-hidden"
        style={{ borderRadius: "50%", ...getRoleBadgeStyle(borderStyle, roleColor, avatarUrl) }}
      >
        {!avatarUrl && displayName[0]?.toUpperCase()}
      </div>
      <span
        className="text-xs truncate font-medium"
        style={{ color: roleColor ?? "var(--color-text-dim)" }}
      >
        {displayName}
      </span>
    </Link>
  );
}

function CommunityNavLink({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className="px-3 py-1.5 text-sm rounded-md transition-colors no-underline block"
      style={({ isActive }) => ({
        color: isActive ? "var(--color-text)" : "var(--color-text-dim)",
        background: isActive ? "var(--color-bg-elev-2)" : undefined,
        fontWeight: isActive ? "500" : undefined,
      })}
    >
      {label}
    </NavLink>
  );
}

function JoinButton({
  communityId,
  slug,
  membership,
  user,
}: {
  communityId: string;
  slug: string;
  membership: { role: string } | null;
  user: { id: string } | null;
}) {
  const fetcher = useFetcher();
  const joined = !!membership;
  const pending = fetcher.state !== "idle";

  if (!user) {
    return (
      <Link
        to="/auth/signup"
        className="w-full text-center px-3 py-1.5 text-sm font-medium rounded-md no-underline block"
        style={{ background: "var(--color-text)", color: "var(--color-bg)" }}
      >
        Join community
      </Link>
    );
  }

  return (
    <fetcher.Form method="post" action={`/c/${slug}/join`}>
      <input type="hidden" name="communityId" value={communityId} />
      <input type="hidden" name="action" value={joined ? "leave" : "join"} />
      <button
        type="submit"
        disabled={pending}
        className="w-full px-3 py-1.5 text-sm font-medium rounded-md transition-opacity disabled:opacity-60"
        style={
          joined
            ? {
                background: "var(--color-bg-elev-2)",
                color: "var(--color-text-dim)",
                border: "1px solid var(--color-border)",
              }
            : { background: "var(--color-text)", color: "var(--color-bg)" }
        }
      >
        {pending ? "..." : joined ? "Leave" : "Join"}
      </button>
    </fetcher.Form>
  );
}
