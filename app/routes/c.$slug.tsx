import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import {
  Link,
  NavLink,
  Outlet,
  useFetcher,
  useLoaderData,
  useRouteLoaderData,
} from "@remix-run/react";
import { and, eq, isNull } from "drizzle-orm";
import type React from "react";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import type { loader as rootLoader } from "~/root";
import { communities, communityMemberships } from "../../db/schema";
import { CommunityAvatar } from "./communities._index";

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

  return { community, membership: membership ?? null, user };
}

export default function CommunityHub() {
  const { community, membership } = useLoaderData<typeof loader>();
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const rootUser = root?.user ?? null;

  const isMod =
    membership?.role === "mod" || membership?.role === "senior_mod" || membership?.role === "admin";

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
    </nav>
  );

  const rightRail = (
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
        <div className="flex justify-between text-xs" style={{ color: "var(--color-text-faint)" }}>
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
  );

  return (
    <div
      className="flex flex-col min-h-screen"
      style={
        {
          background: community.backgroundCss ?? "var(--color-bg)",
          ...(community.accentColor ? { "--color-accent": community.accentColor } : {}),
        } as React.CSSProperties
      }
    >
      <Header user={rootUser} />
      <AppShell leftNav={leftNav} rightRail={rightRail} transparent>
        <Outlet />
      </AppShell>
      <Footer />
    </div>
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
