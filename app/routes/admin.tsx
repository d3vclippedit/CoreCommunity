import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { eq } from "drizzle-orm";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { users } from "../../db/schema";

export const meta: MetaFunction = () => [{ title: "Admin — CORE" }];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user?.isPlatformAdmin) throw new Response("Forbidden", { status: 403 });
  return { user };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const currentUser = await getCurrentUser(request, env);
  if (!currentUser?.isPlatformAdmin) throw new Response("Forbidden", { status: 403 });

  const form = await request.formData();
  const handle = (form.get("handle") as string | null)?.trim().toLowerCase() ?? "";
  const intent = (form.get("intent") as string | null) ?? "";

  if (!handle) return { error: "Handle is required." };
  if (intent !== "verify" && intent !== "unverify") return { error: "Unknown action." };

  const db = createDb(env.DB);
  const target = await db.query.users.findFirst({
    where: eq(users.handle, handle),
    columns: { id: true, handle: true },
  });
  if (!target) return { error: `No user found with handle @${handle}.` };

  await db
    .update(users)
    .set({ isVerifiedStreamer: intent === "verify" })
    .where(eq(users.id, target.id));

  return { ok: true, handle: target.handle, verified: intent === "verify" };
}

export default function AdminPage() {
  const { user } = useLoaderData<typeof loader>();
  const data = useActionData<typeof action>();
  const nav = useNavigation();
  const submitting = nav.state === "submitting";

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header user={user} />
      <AppShell>
        <div className="py-6 max-w-lg">
          <h1 className="text-xl font-semibold mb-6" style={{ color: "var(--color-text)" }}>
            Platform Admin
          </h1>

          <div
            className="rounded-lg p-5"
            style={{
              background: "var(--color-bg-elev-1)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text)" }}>
              Verified Streamer Badge
            </h2>

            {data && "error" in data && (
              <p className="text-sm mb-3" style={{ color: "var(--color-danger)" }}>
                {data.error}
              </p>
            )}
            {data && "ok" in data && (
              <p className="text-sm mb-3" style={{ color: "var(--color-success)" }}>
                @{data.handle} is now {data.verified ? "verified ✓" : "unverified"}.
              </p>
            )}

            <Form method="post" className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="handle"
                  className="text-xs font-medium"
                  style={{ color: "var(--color-text-dim)" }}
                >
                  Handle (without @)
                </label>
                <input
                  id="handle"
                  name="handle"
                  type="text"
                  placeholder="streamer_handle"
                  required
                  autoComplete="off"
                  className="w-full rounded-md px-3 py-2 text-sm"
                  style={{
                    background: "var(--color-bg-elev-2)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                    outline: "none",
                  }}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  name="intent"
                  value="verify"
                  disabled={submitting}
                  className="px-4 py-1.5 text-sm font-medium rounded-md disabled:opacity-60"
                  style={{ background: "var(--color-success)", color: "#000" }}
                >
                  {submitting ? "…" : "Grant badge"}
                </button>
                <button
                  type="submit"
                  name="intent"
                  value="unverify"
                  disabled={submitting}
                  className="px-4 py-1.5 text-sm font-medium rounded-md disabled:opacity-60"
                  style={{
                    background: "var(--color-bg-elev-2)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-dim)",
                  }}
                >
                  {submitting ? "…" : "Remove badge"}
                </button>
              </div>
            </Form>
          </div>
        </div>
      </AppShell>
      <Footer />
    </div>
  );
}
