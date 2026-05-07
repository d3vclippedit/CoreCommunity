import { Form, Link, useLocation, useRouteLoaderData } from "@remix-run/react";
import { Coins } from "lucide-react";
import coreMiniUrl from "~/assets/coremini2.png";
import { cn } from "~/lib/cn";
import { formatCoins } from "~/lib/coins";
import type { loader as rootLoader } from "~/root";

interface HeaderProps {
  user?: {
    displayName: string;
    handle: string;
    avatarUrl?: string | null;
  } | null;
}

export function Header({ user }: HeaderProps) {
  const location = useLocation();
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const coinBalance = root?.coinBalance ?? 0;

  return (
    <header
      className="sticky top-0 z-40 w-full"
      style={{
        background: "rgba(10, 10, 12, 0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div
        className="mx-auto flex h-14 items-center gap-6 px-4 md:px-6"
        style={{ maxWidth: "1280px" }}
      >
        {/* CORE mini logo */}
        <Link
          to="/"
          className="flex-shrink-0 flex items-center no-underline"
          aria-label="CORE Communities — home"
        >
          <img
            src={coreMiniUrl}
            alt="CORE Communities"
            style={{
              height: 36,
              width: "auto",
              mixBlendMode: "screen",
              filter: "brightness(1.05)",
              display: "block",
            }}
          />
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1 flex-1" aria-label="Main navigation">
          {user && <NavLink to="/" label="Feed" exact />}
          <NavLink to="/communities" label="Communities" />
          {user && <NavLink to="/monetization" label="Core Coins" excludeSearch="tab=earn" />}
          {user && (
            <NavLink to="/monetization?tab=earn" label="Creator Earnings" matchSearch="tab=earn" />
          )}
        </nav>

        {/* Right side — coins + auth/user */}
        <div className="flex items-center gap-3 ml-auto">
          {user && (
            <Link
              to="/monetization"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg no-underline transition-colors hover:opacity-80"
              style={{
                background: "var(--color-bg-elev-1)",
                border: "1px solid var(--color-border)",
              }}
              aria-label="Core Coins balance"
            >
              {/* Emblem placeholder — swap for real logo asset when ready */}
              <span
                className="flex items-center justify-center rounded-md flex-shrink-0"
                style={{
                  width: 22,
                  height: 22,
                  background: "var(--color-bg-elev-2)",
                  border: "1px solid var(--color-border)",
                }}
                aria-hidden="true"
              >
                <Coins size={13} style={{ color: "var(--color-text-dim)" }} />
              </span>
              <span
                className="text-xs font-semibold tabular-nums"
                style={{ color: "var(--color-text)" }}
              >
                {formatCoins(coinBalance)}
              </span>
              <span className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                cc
              </span>
            </Link>
          )}

          {user ? (
            <UserMenu user={user} />
          ) : (
            <>
              <Link
                to="/auth/login"
                className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
                style={{ color: "var(--color-text-dim)" }}
              >
                Log in
              </Link>
              <Link
                to="/auth/signup"
                className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
                style={{
                  background: "var(--color-text)",
                  color: "var(--color-bg)",
                }}
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({
  to,
  label,
  exact,
  matchSearch,
  excludeSearch,
}: {
  to: string;
  label: string;
  exact?: boolean;
  matchSearch?: string;
  excludeSearch?: string;
}) {
  const location = useLocation();
  const pathname = to.split("?")[0];
  const pathActive = exact
    ? location.pathname === pathname
    : location.pathname.startsWith(pathname);

  let active: boolean;
  if (matchSearch) {
    active = pathActive && location.search.includes(matchSearch);
  } else if (excludeSearch) {
    active = pathActive && !location.search.includes(excludeSearch);
  } else {
    active = pathActive;
  }

  return (
    <Link
      to={to}
      className={cn(
        "px-3 py-1.5 text-sm rounded-md transition-colors no-underline",
        active ? "font-medium" : "",
      )}
      style={{
        color: active ? "var(--color-text)" : "var(--color-text-dim)",
        background: active ? "var(--color-bg-elev-2)" : undefined,
      }}
    >
      {label}
    </Link>
  );
}

function UserMenu({
  user,
}: {
  user: { displayName: string; handle: string; avatarUrl?: string | null };
}) {
  return (
    <div className="flex items-center gap-1">
      <Link
        to={`/u/${user.handle}`}
        className="flex items-center gap-2 px-2 py-1 rounded-md transition-colors no-underline"
        style={{ color: "var(--color-text)" }}
      >
        <Avatar displayName={user.displayName} avatarUrl={user.avatarUrl} size={28} />
        <span className="hidden sm:block text-sm font-medium">{user.displayName}</span>
      </Link>
      <Form method="post" action="/auth/logout">
        <button
          type="submit"
          className="px-2 py-1 text-xs rounded-md transition-colors"
          style={{ color: "var(--color-text-faint)" }}
        >
          Log out
        </button>
      </Form>
    </div>
  );
}

export function Avatar({
  displayName,
  avatarUrl,
  size = 32,
}: {
  displayName: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={displayName}
        width={size}
        height={size}
        className="rounded-full object-cover flex-shrink-0"
        style={{
          width: size,
          height: size,
          border: "1px solid var(--color-border)",
        }}
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

