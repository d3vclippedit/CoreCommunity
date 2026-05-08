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
 *
 * When `transparent` is true (community hub), the outer background is clear so
 * the community's custom background shows through, and each column scrolls
 * independently within a fixed-height viewport layout.
 */
export function AppShell({ leftNav, rightRail, children, className, transparent }: AppShellProps) {
  if (transparent) {
    return (
      <div className={cn("h-full overflow-hidden", className)}>
        <div
          className="mx-auto w-full h-full flex flex-col px-4 md:px-6"
          style={{ maxWidth: "1520px" }}
        >
          {/* Dark floating card — each column scrolls independently */}
          <div
            className="flex gap-6 flex-1 pt-6 px-6 md:px-10 mx-2 md:mx-4 my-8"
            style={{
              background: "var(--color-bg)",
              borderRadius: "14px",
              boxShadow: "0 8px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.05)",
              minHeight: 0,
            }}
          >
            {leftNav && (
              <aside
                className="hidden lg:flex flex-col flex-shrink-0 w-72 xl:w-80 overflow-y-auto"
                aria-label="Community navigation"
              >
                <div className="pb-8 pr-4">{leftNav}</div>
              </aside>
            )}

            <main
              className="flex-1 min-w-0 overflow-y-auto"
              style={{ maxWidth: rightRail ? "720px" : undefined }}
            >
              <div className="pb-8 px-4 md:px-6">{children}</div>
            </main>

            {rightRail && (
              <aside
                className="hidden xl:flex flex-col flex-shrink-0 w-80 xl:w-96 overflow-y-auto"
                aria-label="Community info"
              >
                <div className="space-y-4 pb-8 pl-2 pr-4">{rightRail}</div>
              </aside>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen", className)} style={{ background: "var(--color-bg)" }}>
      <div className="mx-auto w-full px-4 md:px-6" style={{ maxWidth: "1280px" }}>
        <div className="flex gap-6 pb-16 pt-6">
          {leftNav && (
            <aside
              className="hidden lg:block flex-shrink-0 w-56 xl:w-64"
              aria-label="Community navigation"
            >
              <div className="sticky top-20">{leftNav}</div>
            </aside>
          )}

          <main className="flex-1 min-w-0" style={{ maxWidth: rightRail ? "720px" : undefined }}>
            {children}
          </main>

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
