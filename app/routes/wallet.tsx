import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { redirect, useLoaderData, useRouteLoaderData } from "@remix-run/react";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { getCurrentUser } from "~/lib/auth/user.server";
import { formatCoins } from "~/lib/coins";
import { getBalance, getTransactionHistory } from "~/lib/coins.server";
import { createDb } from "~/lib/db/index";
import type { loader as rootLoader } from "~/root";

export const meta: MetaFunction = () => [{ title: "Wallet — Cormunities" }];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) return redirect("/auth/login");

  const db = createDb(env.DB);
  const [balance, transactions] = await Promise.all([
    getBalance(db, user.id),
    getTransactionHistory(db, user.id, 50),
  ]);

  return { user, balance, transactions };
}

const TX_LABELS: Record<string, string> = {
  purchase: "Bought coins",
  spend: "Badge given",
  refund: "Refund",
  admin_credit: "Admin credit",
  admin_debit: "Admin debit",
  earning: "Creator earning",
};

export default function WalletPage() {
  const { balance, transactions } = useLoaderData<typeof loader>();
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const rootUser = root?.user ?? null;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header user={rootUser} />
      <AppShell>
        <div className="py-6 max-w-2xl">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold" style={{ color: "var(--color-text)" }}>
              Wallet
            </h1>
            <a
              href="/coins"
              className="px-4 py-1.5 text-sm font-medium rounded-md transition-opacity hover:opacity-80"
              style={{ background: "var(--color-text)", color: "var(--color-bg)" }}
            >
              Buy coins
            </a>
          </div>

          {/* Balance card */}
          <div
            className="rounded-xl p-6 mb-6"
            style={{
              background: "var(--color-bg-elev-1)",
              border: "1px solid var(--color-border)",
            }}
          >
            <p
              className="text-xs uppercase tracking-wide mb-1"
              style={{ color: "var(--color-text-faint)" }}
            >
              Current balance
            </p>
            <p className="text-4xl font-bold" style={{ color: "var(--color-text)" }}>
              {formatCoins(balance)}
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--color-text-faint)" }}>
              Core Coins
            </p>
          </div>

          {/* Transaction history */}
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text)" }}>
            Transaction history
          </h2>

          {transactions.length === 0 ? (
            <div
              className="rounded-xl p-6 text-center"
              style={{
                background: "var(--color-bg-elev-1)",
                border: "1px solid var(--color-border)",
              }}
            >
              <p className="text-sm" style={{ color: "var(--color-text-faint)" }}>
                No transactions yet.
              </p>
              <a
                href="/coins"
                className="inline-block mt-3 text-sm"
                style={{ color: "var(--color-text-dim)" }}
              >
                Buy your first coins →
              </a>
            </div>
          ) : (
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: "var(--color-bg-elev-1)",
                border: "1px solid var(--color-border)",
              }}
            >
              {transactions.map((tx, i) => {
                const isCredit = tx.amount > 0;
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between px-4 py-3"
                    style={{ borderTop: i > 0 ? "1px solid var(--color-border)" : undefined }}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                        {TX_LABELS[tx.type] ?? tx.type}
                      </p>
                      {tx.note && (
                        <p
                          className="text-xs truncate"
                          style={{ color: "var(--color-text-faint)" }}
                        >
                          {tx.note}
                        </p>
                      )}
                      <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                        {new Date(tx.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className="text-sm font-semibold flex-shrink-0 ml-4"
                      style={{ color: isCredit ? "var(--color-success)" : "var(--color-danger)" }}
                    >
                      {isCredit ? "+" : ""}
                      {formatCoins(tx.amount)} cc
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </AppShell>
      <Footer />
    </div>
  );
}
