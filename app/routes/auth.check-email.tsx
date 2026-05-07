import type { MetaFunction } from "@remix-run/cloudflare";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = () => [{ title: "Check your email — Cormunities" }];

export default function CheckEmail() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--color-bg)" }}
    >
      <div className="text-center max-w-sm">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: "var(--color-bg-elev-2)", border: "1px solid var(--color-border)" }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--color-text-dim)" }}
            aria-hidden="true"
          >
            <rect width="20" height="16" x="2" y="4" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold mb-2" style={{ color: "var(--color-text)" }}>
          Check your email
        </h1>
        <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--color-text-dim)" }}>
          We sent a verification link to your email address. Click it to activate your account. You
          can browse Cormunities while you wait, but you won't be able to post until you're verified.
        </p>
        <Link
          to="/"
          className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium no-underline"
          style={{
            background: "var(--color-bg-elev-2)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
        >
          Continue to Cormunities
        </Link>
      </div>
    </div>
  );
}
