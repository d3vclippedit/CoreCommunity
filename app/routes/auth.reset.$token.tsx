import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { and, eq, gt, isNull } from "drizzle-orm";
import { Alert } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { PasswordInput } from "~/components/ui/Input";
import { PASSWORD_ERROR_MESSAGES, hashPassword, validatePassword } from "~/lib/auth/password";
import { createDb } from "~/lib/db/index";
import { passwordResets, users } from "../../db/schema";

export const meta: MetaFunction = () => [{ title: "Reset password — Cormunities" }];

export async function loader({ params, context }: LoaderFunctionArgs) {
  const db = createDb(context.cloudflare.env.DB);
  const reset = await db.query.passwordResets.findFirst({
    where: and(
      eq(passwordResets.token, params.token ?? ""),
      gt(passwordResets.expiresAt, new Date()),
      isNull(passwordResets.usedAt),
    ),
    columns: { id: true },
  });
  return { valid: !!reset };
}

export async function action({ request, params, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const db = createDb(env.DB);

  const reset = await db.query.passwordResets.findFirst({
    where: and(
      eq(passwordResets.token, params.token ?? ""),
      gt(passwordResets.expiresAt, new Date()),
      isNull(passwordResets.usedAt),
    ),
  });

  if (!reset) return { error: "This link is invalid or has expired." };

  const form = await request.formData();
  const password = (form.get("password") as string | null) ?? "";
  const passwordError = validatePassword(password);
  if (passwordError) return { error: PASSWORD_ERROR_MESSAGES[passwordError] };

  const hash = await hashPassword(password);
  const now = new Date();

  await Promise.all([
    db.update(users).set({ passwordHash: hash, updatedAt: now }).where(eq(users.id, reset.userId)),
    db.update(passwordResets).set({ usedAt: now }).where(eq(passwordResets.id, reset.id)),
  ]);

  return redirect("/auth/login?reset=1");
}

export default function ResetPassword() {
  const { valid } = useLoaderData<typeof loader>();
  const data = useActionData<typeof action>();
  const nav = useNavigation();

  if (!valid) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: "var(--color-bg)" }}
      >
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-semibold mb-2" style={{ color: "var(--color-text)" }}>
            Link expired
          </h1>
          <p className="text-sm mb-6" style={{ color: "var(--color-text-dim)" }}>
            This password reset link is invalid or has expired.
          </p>
          <Link
            to="/auth/forgot"
            className="text-sm font-medium no-underline hover:underline"
            style={{ color: "var(--color-text)" }}
          >
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--color-bg)" }}
    >
      <div className="w-full max-w-sm">
        <Link to="/" className="block text-center mb-8 no-underline">
          <span className="text-2xl font-display font-bold" style={{ color: "var(--color-text)" }}>
            CORE
          </span>
        </Link>
        <div
          className="p-6 rounded-lg"
          style={{ background: "var(--color-bg-elev-1)", border: "1px solid var(--color-border)" }}
        >
          <h1 className="text-lg font-semibold mb-6" style={{ color: "var(--color-text)" }}>
            Set new password
          </h1>
          {data?.error && (
            <Alert variant="error" className="mb-4">
              {data.error}
            </Alert>
          )}
          <Form method="post" className="flex flex-col gap-4">
            <PasswordInput
              id="password"
              name="password"
              label="New password"
              placeholder="Min 10 characters"
              autoComplete="new-password"
              hint="At least 10 characters with 3 of: lowercase, uppercase, numbers, symbols."
              required
            />
            <Button type="submit" loading={nav.state === "submitting"} className="w-full">
              Set new password
            </Button>
          </Form>
        </div>
      </div>
    </div>
  );
}
