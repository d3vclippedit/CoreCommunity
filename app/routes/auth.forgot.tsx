import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";
import { Form, Link, useActionData, useNavigation } from "@remix-run/react";
import { eq } from "drizzle-orm";
import { Alert } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { passwordResetEmailHtml, sendEmail } from "~/lib/auth/email";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { checkRateLimit, getIp } from "~/lib/ratelimit";
import { expiresAt, generateId, generateToken } from "~/lib/utils";
import { passwordResets, users } from "../../db/schema";

export const meta: MetaFunction = () => [{ title: "Forgot password — Cormunities" }];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await getCurrentUser(request, context.cloudflare.env);
  if (user) return redirect("/");
  return null;
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;

  const rl = await checkRateLimit(env.KV, "forgot", getIp(request), 3, 3600);
  if (!rl.allowed) {
    return { sent: false, error: "Too many requests. Try again later." };
  }

  const form = await request.formData();
  const identifier = (form.get("identifier") as string | null)?.trim().toLowerCase() ?? "";

  // Always return success to avoid account enumeration
  if (!identifier) return { sent: true };

  const db = createDb(env.DB);
  const isEmail = identifier.includes("@");
  const user = await db.query.users.findFirst({
    where: isEmail ? eq(users.email, identifier) : eq(users.handle, identifier.replace(/^@/, "")),
    columns: { id: true, email: true, deletedAt: true },
  });

  if (user && !user.deletedAt) {
    const token = generateToken();
    const now = new Date();
    await db.insert(passwordResets).values({
      id: generateId(),
      userId: user.id,
      token,
      expiresAt: expiresAt(3600), // 1 hour
      createdAt: now,
    });
    const baseUrl = new URL(request.url).origin;
    try {
      await sendEmail(env.RESEND_API_KEY, {
        to: user.email,
        subject: "Reset your Cormunities password",
        html: passwordResetEmailHtml(`${baseUrl}/auth/reset/${token}`),
      });
    } catch {
      /* silent */
    }
  }

  return { sent: true };
}

export default function Forgot() {
  const data = useActionData<typeof action>();
  const nav = useNavigation();

  if (data?.sent) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: "var(--color-bg)" }}
      >
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-semibold mb-2" style={{ color: "var(--color-text)" }}>
            Check your email
          </h1>
          <p className="text-sm mb-6" style={{ color: "var(--color-text-dim)" }}>
            If an account with that email or handle exists, we've sent a password reset link.
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
          <h1 className="text-lg font-semibold mb-2" style={{ color: "var(--color-text)" }}>
            Forgot your password?
          </h1>
          <p className="text-sm mb-6" style={{ color: "var(--color-text-dim)" }}>
            Enter your email or handle and we'll send a reset link.
          </p>
          {data && "error" in data && data.error && (
            <Alert variant="error" className="mb-4">
              {data.error}
            </Alert>
          )}
          <Form method="post" className="flex flex-col gap-4">
            <Input
              id="identifier"
              name="identifier"
              type="text"
              label="Email or @handle"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
            <Button type="submit" loading={nav.state === "submitting"} className="w-full">
              Send reset link
            </Button>
          </Form>
        </div>
        <p className="text-center text-sm mt-4">
          <Link
            to="/auth/login"
            className="no-underline hover:underline"
            style={{ color: "var(--color-text-dim)" }}
          >
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}
