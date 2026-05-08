import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import {
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { eq } from "drizzle-orm";
import { Alert } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { createSession, makeSessionCookie } from "~/lib/auth/session";
import { verifyTotp } from "~/lib/auth/totp";
import { createDb } from "~/lib/db/index";
import { users } from "../../db/schema";

export const meta: MetaFunction = () => [{ title: "Two-factor authentication — CORE" }];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const url = new URL(request.url);
  const token = url.searchParams.get("t");
  if (!token) return redirect("/auth/login");

  const stored = await env.KV.get(`pending_totp:${token}`);
  if (!stored) return redirect("/auth/login?expired=1");

  const { expiresAt } = JSON.parse(stored) as { userId: string; expiresAt: number };
  if (expiresAt < Math.floor(Date.now() / 1000)) {
    await env.KV.delete(`pending_totp:${token}`);
    return redirect("/auth/login?expired=1");
  }

  return { token };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const form = await request.formData();
  const token = (form.get("token") as string | null) ?? "";
  const code = (form.get("code") as string | null)?.replace(/\s/g, "") ?? "";
  const redirectTo = (form.get("redirectTo") as string | null) ?? "/";

  if (!token || !code) return { error: "Enter your 6-digit code." };

  const stored = await env.KV.get(`pending_totp:${token}`);
  if (!stored) return redirect("/auth/login?expired=1");

  const { userId, expiresAt } = JSON.parse(stored) as { userId: string; expiresAt: number };
  if (expiresAt < Math.floor(Date.now() / 1000)) {
    await env.KV.delete(`pending_totp:${token}`);
    return redirect("/auth/login?expired=1");
  }

  const db = createDb(env.DB);
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { totpSecret: true },
  });
  if (!user?.totpSecret) return { error: "2FA not configured." };

  const valid = await verifyTotp(user.totpSecret, code);
  if (!valid) return { error: "Incorrect code. Try again." };

  await env.KV.delete(`pending_totp:${token}`);
  const sessionToken = await createSession(env.KV, userId);
  const safe = redirectTo.startsWith("/") ? redirectTo : "/";
  return redirect(safe, { headers: { "Set-Cookie": makeSessionCookie(sessionToken) } });
}

export default function TwoFAPage() {
  const { token } = useLoaderData<typeof loader>();
  const data = useActionData<typeof action>();
  const nav = useNavigation();

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
          <h1 className="text-lg font-semibold mb-2" style={{ color: "var(--color-text)" }}>
            Two-factor authentication
          </h1>
          <p className="text-sm mb-5" style={{ color: "var(--color-text-faint)" }}>
            Enter the 6-digit code from your authenticator app.
          </p>

          {data && "error" in data && (
            <Alert variant="error" className="mb-4">
              {data.error}
            </Alert>
          )}

          <Form method="post" className="flex flex-col gap-4">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="redirectTo" value="/" />
            <Input
              id="code"
              name="code"
              type="text"
              label="Authentication code"
              placeholder="123 456"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={7}
              required
            />
            <Button type="submit" loading={nav.state === "submitting"} className="w-full">
              Verify
            </Button>
          </Form>
        </div>

        <p className="text-center text-sm mt-4" style={{ color: "var(--color-text-dim)" }}>
          <Link
            to="/auth/login"
            className="no-underline hover:underline"
            style={{ color: "var(--color-text-dim)" }}
          >
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
