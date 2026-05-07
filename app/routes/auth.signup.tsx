import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Form, Link, redirect, useActionData, useNavigation } from "@remix-run/react";
import { eq, inArray } from "drizzle-orm";
import { Alert } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { sendEmail, verificationEmailHtml } from "~/lib/auth/email";
import { HANDLE_ERROR_MESSAGES, validateHandle } from "~/lib/auth/handle";
import { PASSWORD_ERROR_MESSAGES, hashPassword, validatePassword } from "~/lib/auth/password";
import { createSession, makeSessionCookie } from "~/lib/auth/session";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { checkRateLimit, getIp } from "~/lib/ratelimit";
import { expiresAt, generateId, generateToken } from "~/lib/utils";
import { emailVerifications, users } from "../../db/schema";

export const meta: MetaFunction = () => [{ title: "Sign up — Cormunities" }];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (user) return redirect("/");
  return null;
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;

  const rl = await checkRateLimit(env.KV, "signup", getIp(request), 5, 3600);
  if (!rl.allowed) {
    return {
      errors: {
        form: `Too many sign-up attempts. Try again in ${Math.ceil(rl.retryAfterSeconds / 60)} minutes.`,
      } as Record<string, string>,
      suggestions: [] as string[],
    };
  }

  const form = await request.formData();
  const email = (form.get("email") as string | null)?.trim().toLowerCase() ?? "";
  const handle = (form.get("handle") as string | null)?.trim().toLowerCase() ?? "";
  const displayName = (form.get("displayName") as string | null)?.trim() ?? "";
  const password = (form.get("password") as string | null) ?? "";

  const errors: Record<string, string> = {};

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = "Enter a valid email address.";
  if (!displayName || displayName.length < 1 || displayName.length > 32)
    errors.displayName = "Display name must be 1–32 characters.";

  const handleError = validateHandle(handle);
  if (handleError) errors.handle = HANDLE_ERROR_MESSAGES[handleError];

  const passwordError = validatePassword(password);
  if (passwordError) errors.password = PASSWORD_ERROR_MESSAGES[passwordError];

  if (Object.keys(errors).length > 0) return { errors, suggestions: [] as string[] };

  const db = createDb(env.DB);

  const [existingEmail, existingHandle] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true } }),
    db.query.users.findFirst({ where: eq(users.handle, handle), columns: { id: true } }),
  ]);

  if (existingEmail) errors.email = "An account with this email already exists.";

  if (existingHandle) {
    errors.handle = HANDLE_ERROR_MESSAGES.taken;
    const candidates = Array.from({ length: 10 }, (_, i) => `${handle}${i + 1}`).filter(
      (c) => validateHandle(c) === null,
    );
    const takenRows =
      candidates.length > 0
        ? await db.query.users.findMany({
            where: inArray(users.handle, candidates),
            columns: { handle: true },
          })
        : [];
    const takenSet = new Set(takenRows.map((u) => u.handle));
    const suggestions = candidates.filter((c) => !takenSet.has(c)).slice(0, 3);
    return { errors, suggestions };
  }

  if (Object.keys(errors).length > 0) return { errors, suggestions: [] as string[] };

  const [userId, verificationToken, passwordHash] = await Promise.all([
    generateId(),
    generateToken(),
    hashPassword(password),
  ]);

  const now = new Date();
  await db.insert(users).values({
    id: userId,
    email,
    handle,
    displayName,
    passwordHash,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(emailVerifications).values({
    id: generateId(),
    userId,
    token: verificationToken,
    expiresAt: expiresAt(86400), // 24h
    createdAt: now,
  });

  const baseUrl = new URL(request.url).origin;
  try {
    await sendEmail(env.RESEND_API_KEY, {
      to: email,
      subject: "Verify your Cormunities account",
      html: verificationEmailHtml(`${baseUrl}/auth/verify/${verificationToken}`),
    });
  } catch {
    // Don't block signup if email fails — user can request a resend
  }

  const sessionToken = await createSession(env.KV, userId);
  return redirect("/auth/check-email", {
    headers: { "Set-Cookie": makeSessionCookie(sessionToken) },
  });
}

export default function Signup() {
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const loading = nav.state === "submitting";
  const errors = actionData?.errors ?? {};
  const suggestions = actionData?.suggestions ?? [];

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
            Create your account
          </h1>

          {errors.form && (
            <Alert variant="error" className="mb-4">
              {errors.form}
            </Alert>
          )}

          <Form method="post" className="flex flex-col gap-4">
            <Input
              id="email"
              name="email"
              type="email"
              label="Email"
              placeholder="you@example.com"
              autoComplete="email"
              required
              error={errors.email}
            />
            <div>
              <Input
                id="handle"
                name="handle"
                type="text"
                label="Handle"
                placeholder="yourhandle"
                autoComplete="username"
                hint="Letters, numbers, underscores. 3–20 characters."
                required
                error={errors.handle}
              />
              {suggestions.length > 0 && (
                <div className="flex gap-2 flex-wrap mt-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        const el = document.getElementById("handle") as HTMLInputElement | null;
                        if (el) el.value = s;
                      }}
                      className="px-2 py-0.5 rounded text-xs font-medium transition-colors hover:opacity-80"
                      style={{
                        background: "var(--color-bg-elev-2)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text-dim)",
                        cursor: "pointer",
                      }}
                    >
                      @{s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Input
              id="displayName"
              name="displayName"
              type="text"
              label="Display name"
              placeholder="Your Name"
              autoComplete="name"
              required
              error={errors.displayName}
            />
            <Input
              id="password"
              name="password"
              type="password"
              label="Password"
              placeholder="Min 8 characters"
              autoComplete="new-password"
              hint="At least 8 characters with 3 of: lowercase, uppercase, numbers, symbols."
              required
              error={errors.password}
            />

            <Button type="submit" loading={loading} className="w-full mt-2">
              Create account
            </Button>
          </Form>
        </div>

        <p className="text-center text-sm mt-4" style={{ color: "var(--color-text-dim)" }}>
          Already have an account?{" "}
          <Link
            to="/auth/login"
            className="font-medium no-underline hover:underline"
            style={{ color: "var(--color-text)" }}
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
