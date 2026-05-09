import { Form, Link, useLocation, useRouteLoaderData } from "@remix-run/react";
import { Bell, Coins } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import coreMiniUrl from "~/assets/logotop.png";
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
  const _location = useLocation();
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const coinBalance = root?.coinBalance ?? 0;
  const unreadNotifCount =
    ((root as Record<string, unknown> | null)?.unreadNotifCount as number) ?? 0;

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
          aria-label="Cormunities — home"
        >
          <img
            src={coreMiniUrl}
            alt="Cormunities"
            className="header-logo"
            style={{
              height: 36,
              width: "auto",
              mixBlendMode: "screen",
              display: "block",
            }}
          />
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1 flex-1" aria-label="Main navigation">
          {user && <NavLink to="/" label="Feed" exact />}
          <NavLink to="/communities" label="Communities" />
          {user && <NavLink to="/monetization" label="Core Coins" />}
          {user && <NavLink to="/earnings" label="Creator Earnings" />}
        </nav>

        {/* Right side — coins + auth/user */}
        <div className="flex items-center gap-3 ml-auto">
          {user && (
            <div
              className="hidden sm:flex items-center rounded-lg overflow-hidden"
              style={{
                background: "var(--color-bg-elev-1)",
                border: "1px solid var(--color-border)",
              }}
            >
              {/* Balance display */}
              <span className="flex items-center gap-1.5 px-3 py-1.5">
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
              </span>
              {/* Buy coins shortcut */}
              <Link
                to="/monetization"
                className="flex items-center justify-center px-2.5 py-1.5 no-underline transition-colors hover:opacity-80"
                style={{
                  borderLeft: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                  fontSize: "15px",
                  fontWeight: 600,
                  lineHeight: 1,
                }}
                aria-label="Buy Core Coins"
              >
                +
              </Link>
            </div>
          )}

          {user && (
            <Link
              to="/notifications"
              className="relative flex items-center justify-center rounded-md transition-colors no-underline"
              style={{ width: 32, height: 32, color: "var(--color-text-dim)" }}
              aria-label="Notifications"
            >
              <Bell size={17} />
              {unreadNotifCount > 0 && (
                <span
                  className="absolute top-0 right-0 min-w-[15px] h-[15px] px-[3px] rounded-full text-[9px] font-bold flex items-center justify-center"
                  style={{ background: "var(--color-danger)", color: "#fff", lineHeight: 1 }}
                >
                  {unreadNotifCount > 99 ? "99+" : unreadNotifCount}
                </span>
              )}
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
        active ? "font-medium" : "tab-btn",
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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-2 py-1 rounded-md transition-colors"
        style={{
          color: "var(--color-text)",
          background: "none",
          border: "none",
          cursor: "pointer",
        }}
      >
        <Avatar displayName={user.displayName} avatarUrl={user.avatarUrl} size={28} />
        <span className="hidden sm:block text-sm font-medium">{user.displayName}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1 w-44 rounded-lg py-1 z-50"
          style={{
            background: "var(--color-bg-elev-1)",
            border: "1px solid var(--color-border)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          <Link
            to={`/u/${user.handle}`}
            onClick={() => setOpen(false)}
            className="flex items-center px-3 py-2 text-sm no-underline transition-colors hover:opacity-80"
            style={{ color: "var(--color-text)", display: "flex" }}
          >
            View profile
          </Link>
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center px-3 py-2 text-sm no-underline transition-colors hover:opacity-80"
            style={{ color: "var(--color-text)", display: "flex" }}
          >
            Account settings
          </Link>
          <div style={{ borderTop: "1px solid var(--color-border)", margin: "4px 0" }} />
          <Form method="post" action="/auth/logout">
            <button
              type="submit"
              className="w-full text-left flex items-center px-3 py-2 text-sm transition-colors hover:opacity-80"
              style={{
                color: "var(--color-danger)",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              Log out
            </button>
          </Form>
        </div>
      )}
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
