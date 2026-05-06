import type { MetaFunction } from "@remix-run/cloudflare";
import { Link, useRouteLoaderData } from "@remix-run/react";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import type { loader as rootLoader } from "~/root";

export const meta: MetaFunction = () => [
  { title: "CORE — Communities for creators who actually run them" },
  {
    name: "description",
    content:
      "CORE is a creator-owned community platform — Reddit-style discoverable forums built specifically for streamers and the people around them.",
  },
  { property: "og:title", content: "CORE" },
  {
    property: "og:description",
    content: "Communities for creators who actually run them.",
  },
  { property: "og:type", content: "website" },
];

export default function Index() {
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const user = root?.user ?? null;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header user={user} />

      <AppShell>
        <div className="flex flex-col items-start gap-10 py-16 md:py-24">
          {/* Hero */}
          <div className="max-w-2xl">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6"
              style={{
                background: "var(--color-bg-elev-2)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-dim)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "var(--color-success)" }}
              />
              Early access — building in public
            </div>

            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-display tracking-tight mb-6 leading-[1.08]"
              style={{ color: "var(--color-text)" }}
            >
              Communities for creators
              <br />
              <span style={{ color: "var(--color-text-dim)" }}>who actually run them.</span>
            </h1>

            <p
              className="text-lg leading-relaxed mb-8 max-w-xl"
              style={{ color: "var(--color-text-dim)" }}
            >
              A creator-owned community platform — forum-style discussion, threaded posts, voting,
              and real moderation tools. Built for streamers and the people around them.
            </p>

            <div className="flex items-center gap-3 flex-wrap">
              <Link
                to="/communities"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold no-underline transition-opacity hover:opacity-80"
                style={{
                  background: "var(--color-text)",
                  color: "var(--color-bg)",
                }}
              >
                Browse communities
              </Link>
              <Link
                to="/auth/signup"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium no-underline transition-colors"
                style={{
                  background: "var(--color-bg-elev-1)",
                  color: "var(--color-text)",
                  border: "1px solid var(--color-border)",
                }}
              >
                Create account
              </Link>
            </div>
          </div>

          {/* Feature callouts */}
          <div
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mt-4"
            style={{ maxWidth: "680px" }}
          >
            {[
              {
                label: "Creator-owned",
                description: "Streamers run their own community. Not a server admin. An owner.",
              },
              {
                label: "Discoverable",
                description: "Forum-style, indexed, identity-bearing. Not ephemeral chat.",
              },
              {
                label: "Actually moderated",
                description: "Roles, mod queues, audit logs, and ban tools that actually work.",
              },
            ].map((f) => (
              <div
                key={f.label}
                className="rounded-lg p-4"
                style={{
                  background: "var(--color-bg-elev-1)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <p className="text-sm font-semibold mb-1" style={{ color: "var(--color-text)" }}>
                  {f.label}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-dim)" }}>
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </AppShell>

      <Footer />
    </div>
  );
}
