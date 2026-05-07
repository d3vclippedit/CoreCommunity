import type { MetaFunction } from "@remix-run/cloudflare";
import { Link, useRouteLoaderData } from "@remix-run/react";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import type { loader as rootLoader } from "~/root";

export const meta: MetaFunction = () => [
  { title: "About — Cormunities" },
  { name: "description", content: "Cormunities is a creator-owned community platform for streamers." },
];

export default function About() {
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const user = root?.user ?? null;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header user={user} />
      <AppShell>
        <div className="py-12 max-w-2xl">
          <h1
            className="text-3xl font-display font-bold tracking-tight mb-6"
            style={{ color: "var(--color-text)" }}
          >
            About Cormunities
          </h1>

          <div
            className="flex flex-col gap-6 text-sm leading-relaxed"
            style={{ color: "var(--color-text-dim)" }}
          >
            <p>
              Cormunities is a creator-owned community platform built for streamers and the people around
              them. Forum-style, discoverable, identity-bearing — not ephemeral chat.
            </p>
            <p>
              Each community on CORE is run by its streamer. Not a Discord server admin — an actual
              owner, with full control over moderation tools, community culture, and member
              experience.
            </p>

            <section>
              <h2 className="text-base font-semibold mb-2" style={{ color: "var(--color-text)" }}>
                Why we built this
              </h2>
              <p>
                Streamers build audiences, but they don't own the infrastructure they live on. When
                Discord changes pricing or Reddit removes API access, communities suffer. Cormunities is
                the alternative: forums you control, built to last.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold mb-2" style={{ color: "var(--color-text)" }}>
                What makes Cormunities different
              </h2>
              <ul className="flex flex-col gap-2 pl-4">
                <li>Threaded posts and comments — not chat, not tweets</li>
                <li>Proper moderation: roles, queues, audit logs, ban tools</li>
                <li>Streamer-owned communities — you run your space</li>
                <li>Indexed and discoverable — builds real community over time</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold mb-2" style={{ color: "var(--color-text)" }}>
                Early access
              </h2>
              <p>
                Cormunities is currently in early access, built in public. Features are still rolling out.
                If something's broken or you have feedback, we want to hear it.
              </p>
            </section>

            <div className="flex gap-4 pt-2">
              <Link
                to="/communities"
                className="px-4 py-2 text-sm font-medium rounded-md no-underline"
                style={{ background: "var(--color-text)", color: "var(--color-bg)" }}
              >
                Browse communities
              </Link>
              <Link
                to="/legal/terms"
                className="px-4 py-2 text-sm font-medium rounded-md no-underline"
                style={{ border: "1px solid var(--color-border)", color: "var(--color-text-dim)" }}
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </AppShell>
      <Footer />
    </div>
  );
}
