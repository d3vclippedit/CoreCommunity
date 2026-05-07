import type { MetaFunction } from "@remix-run/cloudflare";
import { Link, useRouteLoaderData } from "@remix-run/react";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import type { loader as rootLoader } from "~/root";

export const meta: MetaFunction = () => [{ title: "Privacy Policy — Cormunities" }];

export default function Privacy() {
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const user = root?.user ?? null;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header user={user} />
      <AppShell>
        <article className="py-12 max-w-2xl">
          <h1
            className="text-2xl font-display font-bold mb-2"
            style={{ color: "var(--color-text)" }}
          >
            Privacy Policy
          </h1>
          <p className="text-xs mb-8" style={{ color: "var(--color-text-faint)" }}>
            Last updated: May 2026
          </p>

          <div
            className="flex flex-col gap-6 text-sm leading-relaxed"
            style={{ color: "var(--color-text-dim)" }}
          >
            <section>
              <h2 className="text-base font-semibold mb-2" style={{ color: "var(--color-text)" }}>
                What we collect
              </h2>
              <p>
                When you create an account, we collect your email address, username (handle), and
                display name. We also store content you post and actions you take on the platform.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold mb-2" style={{ color: "var(--color-text)" }}>
                How we use it
              </h2>
              <p>
                We use your information to operate the platform — authenticating your account,
                displaying your profile, and sending transactional emails (verification, password
                reset). We do not sell your data.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold mb-2" style={{ color: "var(--color-text)" }}>
                Cookies and sessions
              </h2>
              <p>
                We use a single session cookie to keep you logged in. No third-party tracking
                cookies are set.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold mb-2" style={{ color: "var(--color-text)" }}>
                Data retention
              </h2>
              <p>
                When you delete your account, your profile is marked as deleted and your personal
                information is removed. Posts and comments you made may remain in anonymized form
                for community continuity.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold mb-2" style={{ color: "var(--color-text)" }}>
                Contact
              </h2>
              <p>
                For privacy questions, contact us through the platform. We will respond within 30
                days.
              </p>
            </section>

            <div className="pt-4">
              <Link
                to="/legal/terms"
                className="text-sm no-underline hover:underline"
                style={{ color: "var(--color-text-dim)" }}
              >
                ← Terms of Service
              </Link>
            </div>
          </div>
        </article>
      </AppShell>
      <Footer />
    </div>
  );
}
