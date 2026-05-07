import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { useFetcher, useLoaderData, useRouteLoaderData, useSearchParams } from "@remix-run/react";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { getCurrentUser } from "~/lib/auth/user.server";
import { formatCoins } from "~/lib/coins";
import { getActiveBundles, getBalance } from "~/lib/coins.server";
import { createDb } from "~/lib/db/index";
import type { loader as rootLoader } from "~/root";

export const meta: MetaFunction = () => [
  { title: "Core Coins — CORE" },
  {
    name: "description",
    content: "Buy Core Coins to support creators with badges and boost posts.",
  },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);

  const db = createDb(env.DB);
  const bundles = await getActiveBundles(db);
  const balance = user ? await getBalance(db, user.id) : 0;

  return { user, bundles, balance };
}

export default function CoinsPage() {
  const { user, bundles, balance } = useLoaderData<typeof loader>();
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const rootUser = root?.user ?? null;
  const [params] = useSearchParams();
  const paypalStatus = params.get("paypal");
  const cryptoStatus = params.get("crypto");

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header user={rootUser} />
      <AppShell>
        <div className="py-6 max-w-2xl">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold" style={{ color: "var(--color-text)" }}>
              Core Coins
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--color-text-dim)" }}>
              Give badges to posts you love. Support creators directly.
            </p>
          </div>

          {/* Status banners */}
          {(paypalStatus === "success" || cryptoStatus === "success") && (
            <div
              className="rounded-lg px-4 py-3 mb-5 text-sm font-medium"
              style={{
                background: "rgba(61,214,140,0.1)",
                border: "1px solid var(--color-success)",
                color: "var(--color-success)",
              }}
            >
              Payment confirmed! Coins have been added to your wallet.
            </div>
          )}
          {(paypalStatus === "cancelled" || cryptoStatus === "cancelled") && (
            <div
              className="rounded-lg px-4 py-3 mb-5 text-sm"
              style={{
                background: "rgba(229,72,77,0.1)",
                border: "1px solid var(--color-danger)",
                color: "var(--color-danger)",
              }}
            >
              Payment cancelled. No charge was made.
            </div>
          )}

          {/* Balance */}
          {user && (
            <div
              className="rounded-xl p-5 mb-6 flex items-center justify-between"
              style={{
                background: "var(--color-bg-elev-1)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div>
                <p
                  className="text-xs uppercase tracking-wide mb-1"
                  style={{ color: "var(--color-text-faint)" }}
                >
                  Your balance
                </p>
                <p className="text-3xl font-bold" style={{ color: "var(--color-text)" }}>
                  {formatCoins(balance)}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--color-text-faint)" }}>
                  Core Coins
                </p>
              </div>
              <a
                href="/wallet"
                className="text-xs px-3 py-1.5 rounded-md transition-opacity hover:opacity-80"
                style={{
                  background: "var(--color-bg-elev-2)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-dim)",
                }}
              >
                View history
              </a>
            </div>
          )}

          {/* How it works */}
          <div
            className="rounded-xl p-5 mb-6"
            style={{
              background: "var(--color-bg-elev-1)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text)" }}>
              How it works
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { step: "1", text: "Buy a coin bundle below using PayPal or crypto." },
                { step: "2", text: "Visit any post and give it a badge using your coins." },
                { step: "3", text: "The creator earns a cut. The post gets a visibility boost." },
              ].map(({ step, text }) => (
                <div key={step} className="flex gap-3 items-start">
                  <span
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: "var(--color-bg-elev-2)", color: "var(--color-text-dim)" }}
                  >
                    {step}
                  </span>
                  <p className="text-sm leading-snug" style={{ color: "var(--color-text-dim)" }}>
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Bundles */}
          {!user && (
            <div
              className="rounded-xl p-5 mb-6 text-center"
              style={{
                background: "var(--color-bg-elev-1)",
                border: "1px solid var(--color-border)",
              }}
            >
              <p className="text-sm" style={{ color: "var(--color-text-dim)" }}>
                <a href="/auth/login" style={{ color: "var(--color-text)" }}>
                  Sign in
                </a>{" "}
                to buy Core Coins.
              </p>
            </div>
          )}

          {user && (
            <>
              <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text)" }}>
                Buy coins
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {bundles.map((bundle) => (
                  <BundleCard key={bundle.id} bundle={bundle} />
                ))}
              </div>
            </>
          )}

          {/* Badge list */}
          <div
            className="rounded-xl p-5"
            style={{
              background: "var(--color-bg-elev-1)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text)" }}>
              Badge types
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {BADGE_DISPLAY.map((b) => (
                <div
                  key={b.name}
                  className="flex flex-col items-center gap-1.5 rounded-lg p-3"
                  style={{ background: "var(--color-bg-elev-2)" }}
                >
                  <span className="text-2xl">{b.icon}</span>
                  <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
                    {b.name}
                  </span>
                  <span className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                    {b.coins} cc
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AppShell>
      <Footer />
    </div>
  );
}

const BADGE_DISPLAY = [
  { name: "Lurker", icon: "👻", coins: 50 },
  { name: "Hype", icon: "🔥", coins: 100 },
  { name: "Clip It", icon: "🎬", coins: 250 },
  { name: "W Post", icon: "🏆", coins: 500 },
  { name: "Poggers", icon: "😮", coins: 1000 },
  { name: "Banger", icon: "💥", coins: 2500 },
  { name: "Legend", icon: "⭐", coins: 5000 },
  { name: "Core", icon: "💎", coins: 10000 },
];

type Bundle = {
  id: string;
  name: string;
  coinAmount: number;
  usdPriceCents: number;
  bonusLabel: string | null;
  isActive: boolean;
  displayOrder: number;
};

function BundleCard({ bundle }: { bundle: Bundle }) {
  const paypalFetcher = useFetcher<{ approvalUrl?: string; error?: string }>();
  const cryptoFetcher = useFetcher<{ paymentUrl?: string; error?: string }>();

  const usdDisplay = `$${(bundle.usdPriceCents / 100).toFixed(2)}`;

  // Redirect to payment provider on URL received
  if (paypalFetcher.data?.approvalUrl) {
    window.location.href = paypalFetcher.data.approvalUrl;
  }
  if (cryptoFetcher.data?.paymentUrl) {
    window.location.href = cryptoFetcher.data.paymentUrl;
  }

  const isSubmitting = paypalFetcher.state !== "idle" || cryptoFetcher.state !== "idle";

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3 relative"
      style={{ background: "var(--color-bg-elev-1)", border: "1px solid var(--color-border)" }}
    >
      <div>
        <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
          {bundle.name}
        </p>
        <p className="text-2xl font-bold mt-0.5" style={{ color: "var(--color-text)" }}>
          {formatCoins(bundle.coinAmount)}
          <span className="text-sm font-normal ml-1" style={{ color: "var(--color-text-faint)" }}>
            cc
          </span>
        </p>
        {bundle.bonusLabel && (
          <p className="text-xs mt-0.5" style={{ color: "var(--color-success)" }}>
            {bundle.bonusLabel}
          </p>
        )}
        <p className="text-lg font-semibold mt-1" style={{ color: "var(--color-text-dim)" }}>
          {usdDisplay}
        </p>
      </div>

      {(paypalFetcher.data?.error || cryptoFetcher.data?.error) && (
        <p className="text-xs" style={{ color: "var(--color-danger)" }}>
          {paypalFetcher.data?.error ?? cryptoFetcher.data?.error}
        </p>
      )}

      <div className="flex flex-col gap-2 mt-auto">
        <paypalFetcher.Form method="post" action="/api/coins/paypal/create">
          <input type="hidden" name="bundleId" value={bundle.id} />
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 text-sm font-medium rounded-lg transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: "#0070BA", color: "#fff" }}
          >
            {paypalFetcher.state !== "idle" ? "Redirecting…" : "Buy with PayPal"}
          </button>
        </paypalFetcher.Form>

        <cryptoFetcher.Form method="post" action="/api/coins/crypto/create">
          <input type="hidden" name="bundleId" value={bundle.id} />
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 text-sm font-medium rounded-lg transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{
              background: "var(--color-bg-elev-2)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-dim)",
            }}
          >
            {cryptoFetcher.state !== "idle" ? "Redirecting…" : "Buy with Crypto"}
          </button>
        </cryptoFetcher.Form>
      </div>
    </div>
  );
}
