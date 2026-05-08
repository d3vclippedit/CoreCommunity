import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Form, Link, redirect, useActionData, useNavigation } from "@remix-run/react";
import { eq } from "drizzle-orm";
import { Alert } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import {
  PASSWORD_ERROR_MESSAGES,
  hashPassword,
  validatePassword,
  verifyPassword,
} from "~/lib/auth/password";
import { createSession, makeSessionCookie } from "~/lib/auth/session";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { checkRateLimit, getIp } from "~/lib/ratelimit";
import { users } from "../../db/schema";

export const meta: MetaFunction = () => [{ title: "Log in — Cormunities" }];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await getCurrentUser(request, context.cloudflare.env);
  if (user) return redirect("/");
  return null;
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;

  try {
    const ipRl = await checkRateLimit(env.KV, "login_ip", getIp(request), 5, 30);
    if (!ipRl.allowed) {
      return {
        error: `Too many attempts. Try again in ${Math.ceil(ipRl.retryAfterSeconds / 60)} minutes.`,
      };
    }

    const form = await request.formData();
    const identifier = (form.get("identifier") as string | null)?.trim() ?? "";
    const password = (form.get("password") as string | null) ?? "";
    const redirectTo = (form.get("redirectTo") as string | null) ?? "/";

    if (!identifier || !password) {
      return { error: "Please enter your email or handle and password." };
    }

    const db = createDb(env.DB);
    const isEmail = identifier.includes("@");
    const cleanIdentifier = isEmail
      ? identifier.toLowerCase()
      : identifier.replace(/^@/, "").toLowerCase();

    const user = await db.query.users.findFirst({
      where: isEmail ? eq(users.email, cleanIdentifier) : eq(users.handle, cleanIdentifier),
      columns: {
        id: true,
        email: true,
        handle: true,
        passwordHash: true,
        deletedAt: true,
        isBanned: true,
      },
    });

    // Rate limit per email too
    const emailRl = await checkRateLimit(env.KV, "login_email", cleanIdentifier, 5, 30);

    // First-login password setup: D3V founder account only
    if (
      user &&
      !user.deletedAt &&
      user.handle === "d3v" &&
      user.passwordHash === "__founder_unset__"
    ) {
      const pwErr = validatePassword(password);
      if (pwErr) return { error: PASSWORD_ERROR_MESSAGES[pwErr] };
      const hash = await hashPassword(password);
      await db
        .update(users)
        .set({ passwordHash: hash, updatedAt: new Date() })
        .where(eq(users.id, user.id));
      const token = await createSession(env.KV, user.id);
      return redirect(redirectTo.startsWith("/") ? redirectTo : "/", {
        headers: { "Set-Cookie": makeSessionCookie(token) },
      });
    }

    const valid =
      user &&
      !user.deletedAt &&
      !user.isBanned &&
      (await verifyPassword(password, user.passwordHash));

    if (!valid || !emailRl.allowed) {
      return { error: "Incorrect email/handle or password." };
    }

    const token = await createSession(env.KV, user.id);
    const safeRedirect = redirectTo.startsWith("/") ? redirectTo : "/";
    return redirect(safeRedirect, {
      headers: { "Set-Cookie": makeSessionCookie(token) },
    });
  } catch (err) {
    console.error("Login error:", err);
    return { error: "Something went wrong. Please try again in a moment." };
  }
}

export default function Login() {
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const loading = nav.state === "submitting";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "var(--color-bg)" }}
    >
      <div className="w-full max-w-sm">
        <Link to="/" className="block text-center mb-8 no-underline">
          <span
            className="text-2xl font-display font-bold tracking-tight"
            style={{ color: "var(--color-text)" }}
          >
            CORE
          </span>
        </Link>

        <div
          className="p-6 rounded-lg"
          style={{ background: "var(--color-bg-elev-1)", border: "1px solid var(--color-border)" }}
        >
          <h1 className="text-lg font-semibold mb-6" style={{ color: "var(--color-text)" }}>
            Welcome back
          </h1>

          {actionData?.error && (
            <Alert variant="error" className="mb-4">
              {actionData.error}
            </Alert>
          )}

          <Form method="post" className="flex flex-col gap-4">
            <Input
              id="identifier"
              name="identifier"
              type="text"
              label="Email or @handle"
              placeholder="you@example.com or @yourhandle"
              autoComplete="username"
              required
            />
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-sm font-medium"
                  style={{ color: "var(--color-text)" }}
                >
                  Password
                </label>
                <Link
                  to="/auth/forgot"
                  className="text-xs no-underline hover:underline"
                  style={{ color: "var(--color-text-dim)" }}
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Your password"
                autoComplete="current-password"
                required
              />
            </div>

            <Button type="submit" loading={loading} className="w-full mt-2">
              Log in
            </Button>
          </Form>
        </div>

        <p className="text-center text-sm mt-4" style={{ color: "var(--color-text-dim)" }}>
          Don't have an account?{" "}
          <Link
            to="/auth/signup"
            className="font-medium no-underline hover:underline"
            style={{ color: "var(--color-text)" }}
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
