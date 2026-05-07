import type { ReactNode } from "react";
import { cn } from "~/lib/cn";

interface AppShellProps {
  leftNav?: ReactNode;
  rightRail?: ReactNode;
  children: ReactNode;
  className?: string;
  transparent?: boolean;
}

/**
 * Three-column layout on desktop, two-column on tablet (drops right rail),
 * single-column on mobile (left nav behind drawer).
 * Max page width: ~1280px. Center column max: ~720px on community feeds.
 */
export function AppShell({ leftNav, rightRail, children, className, transparent }: AppShellProps) {
  return (
    <div
      className={cn("min-h-screen", className)}
      style={{ background: transparent ? "transparent" : "var(--color-bg)" }}
    >
      <div className="mx-auto w-full px-4 md:px-6" style={{ maxWidth: "1280px" }}>
        <div className="flex gap-6 pt-6 pb-16">
          {/* Left nav — hidden on mobile, shown as drawer trigger */}
          {leftNav && (
            <aside
              className="hidden lg:block flex-shrink-0 w-56 xl:w-64"
              aria-label="Community navigation"
            >
              <div className="sticky top-20">{leftNav}</div>
            </aside>
          )}

          {/* Center feed */}
          <main className="flex-1 min-w-0" style={{ maxWidth: rightRail ? "720px" : undefined }}>
            {children}
          </main>

          {/* Right rail — hidden on tablet and below */}
          {rightRail && (
            <aside className="hidden xl:block flex-shrink-0 w-72" aria-label="Community info">
              <div className="sticky top-20 space-y-4">{rightRail}</div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

/** Simple centered single-column layout for auth pages, settings, etc. */
export function CenteredShell({
  children,
  className,
}: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("min-h-screen flex flex-col", className)}
      style={{ background: "var(--color-bg)" }}
    >
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full" style={{ maxWidth: "400px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
