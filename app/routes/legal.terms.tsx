import type { MetaFunction } from "@remix-run/cloudflare";
import { Link, useRouteLoaderData } from "@remix-run/react";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import type { loader as rootLoader } from "~/root";

export const meta: MetaFunction = () => [{ title: "Terms of Service — Cormunities" }];

export default function Terms() {
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const user = root?.user ?? null;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header user={user} />
      <AppShell>
        <article className="py-12 max-w-2xl prose-style">
          <h1
            className="text-2xl font-display font-bold mb-2"
            style={{ color: "var(--color-text)" }}
          >
            Terms of Service
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
                1. Acceptance
              </h2>
              <p>
                By accessing or using Cormunities, you agree to these Terms. If you do not agree, do
                not use the platform.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold mb-2" style={{ color: "var(--color-text)" }}>
                2. Account responsibilities
              </h2>
              <p>
                You are responsible for maintaining the security of your account and for all
                activity under your account. You must be at least 13 years old to create an account.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold mb-2" style={{ color: "var(--color-text)" }}>
                3. Content
              </h2>
              <p>
                You retain ownership of content you post. By posting, you grant Cormunities a
                non-exclusive license to display and distribute your content on the platform. You
                are responsible for ensuring your content does not violate any laws or third-party
                rights.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold mb-2" style={{ color: "var(--color-text)" }}>
                4. Prohibited conduct
              </h2>
              <p>You may not use Cormunities to:</p>
              <ul className="flex flex-col gap-1 pl-4 mt-2">
                <li>Post illegal content or content that infringes third-party rights</li>
                <li>Harass, threaten, or abuse other users</li>
                <li>Spam, scrape, or interfere with the platform's operation</li>
                <li>Impersonate others or create misleading accounts</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold mb-2" style={{ color: "var(--color-text)" }}>
                5. Termination
              </h2>
              <p>
                We may suspend or terminate accounts that violate these Terms. You may delete your
                account at any time.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold mb-2" style={{ color: "var(--color-text)" }}>
                6. Disclaimer
              </h2>
              <p>
                Cormunities is provided "as is" without warranties of any kind. We are not liable
                for content posted by users or for any damages arising from use of the platform.
              </p>
            </section>

            <div className="pt-4">
              <Link
                to="/legal/privacy"
                className="text-sm no-underline hover:underline"
                style={{ color: "var(--color-text-dim)" }}
              >
                Privacy Policy →
              </Link>
            </div>
          </div>
        </article>
      </AppShell>
      <Footer />
    </div>
  );
}
