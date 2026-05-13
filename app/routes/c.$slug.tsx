import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import {
  Link,
  NavLink,
  Outlet,
  useFetcher,
  useLoaderData,
  useRouteLoaderData,
} from "@remix-run/react";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { useState } from "react";
import type React from "react";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";

import type { loader as rootLoader } from "~/root";
import {
  communities,
  communityMemberships,
  communityNotificationPrefs,
  communitySubscriptions,
  streamSnapshots,
  users,
} from "../../db/schema";
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
  let notifyNewPosts = false;
  let isSubscribed = false;
  if (user) {
    membership = await db.query.communityMemberships.findFirst({
      where: and(
        eq(communityMemberships.userId, user.id),
        eq(communityMemberships.communityId, community.id),
      ),
      columns: { role: true },
    });
    try {
      const pref = await db.query.communityNotificationPrefs.findFirst({
        where: and(
          eq(communityNotificationPrefs.userId, user.id),
          eq(communityNotificationPrefs.communityId, community.id),
        ),
        columns: { notifyNewPosts: true },
      });
      if (pref) notifyNewPosts = pref.notifyNewPosts;
    } catch {
      // notifications table not yet migrated
    }
    const sub = await db.query.communitySubscriptions.findFirst({
      where: and(
        eq(communitySubscriptions.userId, user.id),
        eq(communitySubscriptions.communityId, community.id),
        eq(communitySubscriptions.status, "active"),
      ),
      columns: { id: true },
    });
    isSubscribed = !!sub;
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

  let streamIsLive: boolean | null = null;
  if (community.twitchChannel) {
    const snap = await db.query.streamSnapshots.findFirst({
      where: eq(streamSnapshots.streamerLogin, community.twitchChannel),
      orderBy: [desc(streamSnapshots.recordedAt)],
      columns: { isLive: true },
    });
    if (snap) streamIsLive = snap.isLive;
  }

  return {
    community,
    membership: membership ?? null,
    notifyNewPosts,
    isSubscribed,
    staffRows,
    ownerUser: ownerUser ?? null,
    host,
    streamIsLive,
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
  const {
    community,
    membership,
    notifyNewPosts,
    isSubscribed,
    staffRows,
    ownerUser,
    host,
    twitchChannel247,
    streamIsLive,
    borderStyles,
  } = useLoaderData<typeof loader>();
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

      <div className="mt-4 flex flex-col gap-2">
        <JoinButton
          communityId={community.id}
          slug={community.slug}
          membership={membership}
          user={rootUser}
        />
        {rootUser && <NotifyToggle communityId={community.id} notifyNewPosts={notifyNewPosts} />}
      </div>

      {community.membershipEnabled && (
        <div className="mt-3">
          <CommunityMembershipWidget
            communityId={community.id}
            priceCoins={community.membershipPriceCoins ?? 0}
            badgeIcon={community.membershipBadgeIcon ?? "⭐"}
            borderColor={community.membershipBorderColor ?? "#F59E0B"}
            isSubscribed={isSubscribed}
            user={rootUser}
          />
        </div>
      )}

      {twitchChannel && (
        <div className="mt-4 flex flex-col gap-2">
          <p
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--color-text-faint)" }}
          >
            {streamIsLive === false && twitchChannel247 ? "24/7 stream" : "Live stream"}
          </p>

          {/* Video: live → main, offline+247 → 247 channel, offline+no247 → placeholder */}
          {streamIsLive !== false ? (
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
          ) : twitchChannel247 ? (
            <>
              <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                Main channel offline — showing 24/7 stream
              </p>
              <div
                className="rounded-md overflow-hidden"
                style={{ border: "1px solid var(--color-border)" }}
              >
                <div style={{ position: "relative", paddingTop: "56.25%" }}>
                  <iframe
                    src={`https://player.twitch.tv/?channel=${twitchChannel247}&parent=${host}&muted=true`}
                    title={`${community.name} 24/7 stream`}
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
            </>
          ) : (
            <div className="rounded-md" style={{ border: "1px solid var(--color-border)" }}>
              <div
                style={{
                  position: "relative",
                  paddingTop: "56.25%",
                  background: "var(--color-bg-elev-2)",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "var(--color-bg-elev-1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--color-text-faint)"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7z" />
                      <line x1="2" y1="21" x2="22" y2="21" />
                    </svg>
                  </div>
                  <p
                    style={{
                      color: "var(--color-text-faint)",
                      fontSize: 13,
                      textAlign: "center",
                      padding: "0 16px",
                    }}
                  >
                    {community.name} is currently offline
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Chat always stays connected to main channel */}
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
        {rootUser && rootUser.id !== community.ownerId && (
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--color-border)" }}>
            <ReportCommunityButton communityId={community.id} />
          </div>
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

  const [immersive, setImmersive] = useState(false);

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={
        {
          background: immersive
            ? "var(--color-bg)"
            : (community.backgroundCss ?? "var(--color-bg)"),
          ...(community.accentColor ? { "--color-accent": community.accentColor } : {}),
        } as React.CSSProperties
      }
    >
      <Header user={rootUser} />
      <AppShell
        leftNav={leftNav}
        rightRail={rightRail}
        transparent={true}
        className="flex-1 min-h-0"
      >
        <Outlet />
      </AppShell>
      {!immersive && <Footer />}
      {/* Immersive toggle — fixed bottom-right */}
      <button
        type="button"
        onClick={() => setImmersive((v) => !v)}
        title={immersive ? "Exit immersive mode" : "Immersive mode"}
        style={{
          position: "fixed",
          bottom: 18,
          right: 18,
          zIndex: 50,
          width: 34,
          height: 34,
          borderRadius: 8,
          background: "var(--color-bg-elev-2)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text-faint)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "color 0.15s, border-color 0.15s",
        }}
      >
        {immersive ? (
          /* compress / exit */
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M9 1h4v4M5 13H1V9M1 5V1h4M13 9v4H9" />
          </svg>
        ) : (
          /* expand */
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M9 1h4v4M5 13H1V9M14 0L9 5M0 14l5-5" />
          </svg>
        )}
      </button>
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
  electric: { animation: "electric-border", speed: "3s linear infinite" },
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

function NotifyToggle({
  communityId,
  notifyNewPosts,
}: {
  communityId: string;
  notifyNewPosts: boolean;
}) {
  const fetcher = useFetcher<{ success?: boolean; enabled?: boolean }>();
  const optimisticEnabled =
    fetcher.formData != null ? fetcher.formData.get("enabled") === "1" : notifyNewPosts;

  return (
    <fetcher.Form method="post" action="/api/community/notify">
      <input type="hidden" name="communityId" value={communityId} />
      <input type="hidden" name="enabled" value={optimisticEnabled ? "0" : "1"} />
      <button
        type="submit"
        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
        style={{
          background: optimisticEnabled ? "rgba(61,214,140,0.1)" : "var(--color-bg-elev-2)",
          color: optimisticEnabled ? "var(--color-success)" : "var(--color-text-faint)",
          border: `1px solid ${optimisticEnabled ? "rgba(61,214,140,0.3)" : "var(--color-border)"}`,
          cursor: "pointer",
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill={optimisticEnabled ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {optimisticEnabled ? "Notifications on" : "Notify me"}
      </button>
    </fetcher.Form>
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

function ReportCommunityButton({ communityId }: { communityId: string }) {
  const [open, setOpen] = useState(false);
  const fetcher = useFetcher<{ ok?: boolean; error?: string }>();
  const done = fetcher.data?.ok;

  if (done) {
    return (
      <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
        Report submitted. Thank you.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs hover:underline"
        style={{
          color: "var(--color-text-faint)",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        Report this community
      </button>
    );
  }

  return (
    <fetcher.Form
      method="post"
      action="/api/report"
      className="flex flex-col gap-2"
      onSubmit={() => setOpen(false)}
    >
      <input type="hidden" name="targetType" value="community" />
      <input type="hidden" name="targetId" value={communityId} />
      <input type="hidden" name="communityId" value={communityId} />
      <select
        name="reason"
        required
        className="rounded px-2 py-1 text-xs w-full"
        style={{
          background: "var(--color-bg-elev-2)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text-dim)",
        }}
      >
        <option value="">Select reason…</option>
        <option value="spam">Spam / fake community</option>
        <option value="harassment">Harassment</option>
        <option value="nsfw">Inappropriate content</option>
        <option value="other">Other</option>
      </select>
      <input
        name="details"
        type="text"
        placeholder="Additional details (optional)"
        maxLength={300}
        className="rounded px-2 py-1 text-xs w-full"
        style={{
          background: "var(--color-bg-elev-2)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text)",
        }}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="text-xs px-3 py-1 rounded"
          style={{
            background: "var(--color-danger)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
        >
          Submit report
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs px-2 py-1 rounded"
          style={{
            background: "var(--color-bg-elev-2)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-faint)",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </fetcher.Form>
  );
}

function CommunityMembershipWidget({
  communityId,
  priceCoins,
  badgeIcon,
  borderColor,
  isSubscribed,
  user,
}: {
  communityId: string;
  priceCoins: number;
  badgeIcon: string;
  borderColor: string;
  isSubscribed: boolean;
  user: { id: string } | null;
}) {
  const fetcher = useFetcher<{ error?: string; success?: boolean }>({
    key: "community-subscribe",
  });
  const optimisticSubscribed =
    fetcher.formAction === "/api/community/subscribe"
      ? true
      : fetcher.formAction === "/api/community/cancel-subscription"
        ? false
        : isSubscribed;
  const isSubmitting = fetcher.state !== "idle";

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${borderColor}` }}>
      <div className="px-3 py-2 flex items-center gap-2" style={{ background: `${borderColor}22` }}>
        <span className="text-base leading-none">{badgeIcon}</span>
        <p className="text-xs font-semibold" style={{ color: borderColor }}>
          Community Membership
        </p>
        {optimisticSubscribed && (
          <span
            className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
            style={{ background: "rgba(61,214,140,0.15)", color: "var(--color-success)" }}
          >
            Active
          </span>
        )}
      </div>
      <div
        className="px-3 py-2.5 flex flex-col gap-2"
        style={{ background: "var(--color-bg-elev-1)" }}
      >
        <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
          {priceCoins.toLocaleString()} cc/week · badge &amp; exclusive post border
        </p>

        {fetcher.data?.error && (
          <p className="text-xs" style={{ color: "var(--color-danger)" }}>
            {fetcher.data.error}
          </p>
        )}

        {!user ? (
          <Link
            to="/auth/login"
            className="w-full text-center py-1.5 text-xs font-semibold rounded-md no-underline block transition-opacity hover:opacity-90"
            style={{ background: borderColor, color: "#000" }}
          >
            Sign in to subscribe
          </Link>
        ) : optimisticSubscribed ? (
          <fetcher.Form method="post" action="/api/community/cancel-subscription">
            <input type="hidden" name="communityId" value={communityId} />
            <button
              type="submit"
              disabled={isSubmitting}
              className="text-xs px-3 py-1 rounded-md transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{
                background: "var(--color-bg-elev-2)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-faint)",
              }}
            >
              {isSubmitting ? "…" : "Cancel membership"}
            </button>
          </fetcher.Form>
        ) : (
          <fetcher.Form method="post" action="/api/community/subscribe">
            <input type="hidden" name="communityId" value={communityId} />
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-1.5 text-xs font-bold rounded-md transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: borderColor, color: "#000" }}
            >
              {isSubmitting ? "Subscribing…" : `Subscribe — ${priceCoins.toLocaleString()} cc/wk`}
            </button>
          </fetcher.Form>
        )}
      </div>
    </div>
  );
}
