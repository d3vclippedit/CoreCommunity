import { Form, Link, useLocation } from "@remix-run/react";
import { cn } from "~/lib/cn";

interface HeaderProps {
  user?: {
    displayName: string;
    handle: string;
    avatarUrl?: string | null;
  } | null;
}

export function Header({ user }: HeaderProps) {
  const location = useLocation();

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
        {/* CORE wordmark */}
        <Link
          to="/"
          className="flex-shrink-0 flex items-center gap-2 no-underline"
          aria-label="CORE — home"
        >
          <CoreWordmark />
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1 flex-1" aria-label="Main navigation">
          <NavLink to="/communities" current={location.pathname} label="Communities" />
        </nav>

        {/* Auth / user area */}
        <div className="flex items-center gap-2 ml-auto">
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
  current,
  label,
}: {
  to: string;
  current: string;
  label: string;
}) {
  const active = current.startsWith(to);
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

function CoreWordmark() {
  return (
    <svg
      width="72"
      height="24"
      viewBox="0 0 72 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="CORE"
      role="img"
    >
      <text
        x="0"
        y="19"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="700"
        fontSize="22"
        letterSpacing="-0.44"
        fill="#F5F5F7"
      >
        CORE
      </text>
    </svg>
  );
}
