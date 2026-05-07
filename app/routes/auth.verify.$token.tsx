import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Link, redirect } from "@remix-run/react";
import { and, eq, gt } from "drizzle-orm";
import { createDb } from "~/lib/db/index";
import { emailVerifications, users } from "../../db/schema";

export const meta: MetaFunction = () => [{ title: "Verify email — Cormunities" }];

export async function loader({ params, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const token = params.token ?? "";

  const db = createDb(env.DB);
  const verification = await db.query.emailVerifications.findFirst({
    where: and(eq(emailVerifications.token, token), gt(emailVerifications.expiresAt, new Date())),
  });

  if (!verification) return { success: false as const };

  await Promise.all([
    db
      .update(users)
      .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, verification.userId)),
    db.delete(emailVerifications).where(eq(emailVerifications.id, verification.id)),
  ]);

  return redirect("/?verified=1");
}

export default function VerifyEmail() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--color-bg)" }}
    >
      <div className="text-center max-w-sm">
        <p className="text-4xl mb-4">✗</p>
        <h1 className="text-xl font-semibold mb-2" style={{ color: "var(--color-text)" }}>
          Invalid or expired link
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--color-text-dim)" }}>
          This verification link has expired or already been used.
        </p>
        <Link
          to="/auth/login"
          className="text-sm font-medium no-underline hover:underline"
          style={{ color: "var(--color-text)" }}
        >
          Back to log in
        </Link>
      </div>
    </div>
  );
}
