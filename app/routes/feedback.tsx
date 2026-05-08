import type { ActionFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Form, redirect, useActionData, useNavigation } from "@remix-run/react";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { feedback } from "../../db/schema";

export const meta: MetaFunction = () => [{ title: "Feedback — Cormunities" }];

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);

  const form = await request.formData();
  const category = (form.get("category") as string | null) ?? "other";
  const message = ((form.get("message") as string | null) ?? "").trim();

  if (!message || message.length < 10) return { error: "Message must be at least 10 characters." };
  if (message.length > 2000) return { error: "Message must be under 2000 characters." };
  if (!["bug", "feature", "support", "other"].includes(category))
    return { error: "Invalid category." };

  const db = createDb(env.DB);
  await db.insert(feedback).values({
    id: crypto.randomUUID(),
    userId: user?.id ?? null,
    category: category as "bug" | "feature" | "support" | "other",
    message,
    status: "open",
    adminNote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return redirect("/feedback?sent=1");
}

export default function FeedbackPage() {
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const submitting = nav.state === "submitting";
  const sent =
    typeof window !== "undefined" && new URL(window.location.href).searchParams.get("sent") === "1";

  const inputCls = "w-full rounded-md px-3 py-2 text-sm outline-none";
  const inputStyle = {
    background: "var(--color-bg-elev-2)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text)",
  } as const;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header user={null} />
      <AppShell>
        <div className="py-10 max-w-lg">
          <h1 className="text-xl font-semibold mb-2" style={{ color: "var(--color-text)" }}>
            Send Feedback
          </h1>
          <p className="text-sm mb-6" style={{ color: "var(--color-text-dim)" }}>
            Report a bug, suggest a feature, or get support. We read every submission.
          </p>

          {sent && (
            <div
              className="rounded-lg p-4 mb-6"
              style={{
                background: "var(--color-bg-elev-1)",
                border: "1px solid var(--color-border)",
              }}
            >
              <p className="text-sm font-medium" style={{ color: "var(--color-success)" }}>
                Thanks — your feedback has been received.
              </p>
            </div>
          )}

          {actionData && "error" in actionData && (
            <p className="text-sm mb-4" style={{ color: "var(--color-danger)" }}>
              {actionData.error}
            </p>
          )}

          <div
            className="rounded-lg p-5"
            style={{
              background: "var(--color-bg-elev-1)",
              border: "1px solid var(--color-border)",
            }}
          >
            <Form method="post" className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="category"
                  className="text-xs font-medium"
                  style={{ color: "var(--color-text-dim)" }}
                >
                  Category
                </label>
                <select
                  id="category"
                  name="category"
                  defaultValue="other"
                  className={inputCls}
                  style={inputStyle}
                >
                  <option value="bug">Bug report</option>
                  <option value="feature">Feature request</option>
                  <option value="support">Support</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="message"
                  className="text-xs font-medium"
                  style={{ color: "var(--color-text-dim)" }}
                >
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={6}
                  placeholder="Describe your bug, idea, or question..."
                  required
                  maxLength={2000}
                  className={inputCls}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium rounded-md disabled:opacity-60"
                style={{ background: "var(--color-text)", color: "var(--color-bg)" }}
              >
                {submitting ? "Sending…" : "Send feedback"}
              </button>
            </Form>
          </div>
        </div>
      </AppShell>
      <Footer />
    </div>
  );
}
