import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "@remix-run/react";
import { eq } from "drizzle-orm";
import { useRef, useState } from "react";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { Alert } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import {
  PASSWORD_ERROR_MESSAGES,
  hashPassword,
  validatePassword,
  verifyPassword,
} from "~/lib/auth/password";
import { getCurrentUser, requireUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { users } from "../../db/schema";

export const meta: MetaFunction = () => [{ title: "Account settings — Cormunities" }];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const user = requireUser(await getCurrentUser(request, env));
  const db = createDb(env.DB);
  const full = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { id: true, handle: true, displayName: true, bio: true, avatarUrl: true, email: true },
  });
  if (!full) throw new Response("Not found", { status: 404 });
  return { user: full };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const user = requireUser(await getCurrentUser(request, env));
  const db = createDb(env.DB);

  const form = await request.formData();
  const intent = (form.get("_intent") as string | null) ?? "";

  if (intent === "profile") {
    const displayName = (form.get("displayName") as string | null)?.trim() ?? "";
    const bio = (form.get("bio") as string | null)?.trim() ?? "";

    if (!displayName || displayName.length < 1 || displayName.length > 64)
      return { error: "Display name must be 1–64 characters.", intent };

    await db
      .update(users)
      .set({ displayName, bio: bio || null, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    return { ok: true, intent };
  }

  if (intent === "password") {
    const current = (form.get("currentPassword") as string | null) ?? "";
    const next = (form.get("newPassword") as string | null) ?? "";
    const confirm = (form.get("confirmPassword") as string | null) ?? "";

    if (!current) return { error: "Current password is required.", intent };
    if (next !== confirm) return { error: "New passwords do not match.", intent };

    const pwError = validatePassword(next);
    if (pwError) return { error: PASSWORD_ERROR_MESSAGES[pwError], intent };

    const row = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: { passwordHash: true },
    });
    if (!row) return { error: "User not found.", intent };

    const valid = await verifyPassword(current, row.passwordHash);
    if (!valid) return { error: "Current password is incorrect.", intent };

    const newHash = await hashPassword(next);
    await db
      .update(users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    return { ok: true, intent };
  }

  return { error: "Unknown action.", intent };
}

export default function SettingsPage() {
  const { user } = useLoaderData<typeof loader>();
  const data = useActionData<typeof action>();
  const nav = useNavigation();
  const [params, setParams] = useSearchParams();

  const isSubmitting = nav.state === "submitting";
  const submittingIntent =
    nav.state === "submitting" ? ((nav.formData?.get("_intent") as string | null) ?? "") : null;

  const activeTab = (params.get("tab") ?? "profile") as "profile" | "security" | "connected";
  const TABS = [
    { id: "profile" as const, label: "Profile" },
    { id: "security" as const, label: "Security" },
    { id: "connected" as const, label: "Connected Accounts" },
  ];

  const profileOk = data && "ok" in data && data.ok && data.intent === "profile";
  const passwordOk = data && "ok" in data && data.ok && data.intent === "password";
  const errorMsg = data && "error" in data ? data.error : null;

  const cardStyle = {
    background: "var(--color-bg-elev-1)",
    border: "1px solid var(--color-border)",
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header user={user} />
      <AppShell>
        <div className="py-6 max-w-xl flex flex-col gap-6">
          <h1 className="text-xl font-semibold" style={{ color: "var(--color-text)" }}>
            Account settings
          </h1>

          {/* Tab bar */}
          <div
            className="flex rounded-lg overflow-hidden"
            style={{
              border: "1px solid var(--color-border)",
              background: "var(--color-bg-elev-1)",
            }}
          >
            {TABS.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setParams(t.id === "profile" ? {} : { tab: t.id })}
                className="flex-1 py-2 text-xs font-medium transition-colors"
                style={{
                  background: activeTab === t.id ? "var(--color-bg-elev-2)" : "transparent",
                  border: "none",
                  borderRight: i < TABS.length - 1 ? "1px solid var(--color-border)" : "none",
                  color: activeTab === t.id ? "var(--color-text)" : "var(--color-text-faint)",
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {profileOk && <Alert variant="success">Profile updated.</Alert>}
          {passwordOk && <Alert variant="success">Password changed.</Alert>}
          {errorMsg && <Alert variant="error">{errorMsg}</Alert>}

          {/* ── Profile tab ── */}
          {activeTab === "profile" && (
            <div className="rounded-lg p-6" style={cardStyle}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text)" }}>
                Profile
              </h2>
              <Form method="post" className="flex flex-col gap-4">
                <input type="hidden" name="_intent" value="profile" />
                <AvatarUpload currentUrl={user.avatarUrl} displayName={user.displayName} />
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-medium" style={{ color: "var(--color-text-dim)" }}>
                    Handle
                  </p>
                  <p className="text-sm font-mono" style={{ color: "var(--color-text-faint)" }}>
                    @{user.handle}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                    Handle cannot be changed.
                  </p>
                </div>
                <Input
                  id="displayName"
                  name="displayName"
                  type="text"
                  label="Display name"
                  defaultValue={user.displayName}
                  required
                />
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="bio"
                    className="text-sm font-medium"
                    style={{ color: "var(--color-text)" }}
                  >
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    name="bio"
                    defaultValue={user.bio ?? ""}
                    rows={3}
                    placeholder="Tell the community about yourself…"
                    className="w-full rounded-md px-3 py-2 text-sm resize-none"
                    style={{
                      background: "var(--color-bg-elev-2)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                      outline: "none",
                    }}
                  />
                </div>
                <Button
                  type="submit"
                  loading={submittingIntent === "profile" && isSubmitting}
                  className="w-full"
                >
                  Save profile
                </Button>
              </Form>
            </div>
          )}

          {/* ── Security tab ── */}
          {activeTab === "security" && (
            <div className="flex flex-col gap-4">
              {/* Change password */}
              <div className="rounded-lg p-6" style={cardStyle}>
                <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text)" }}>
                  Change password
                </h2>
                <Form method="post" className="flex flex-col gap-4">
                  <input type="hidden" name="_intent" value="password" />
                  <Input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    label="Current password"
                    autoComplete="current-password"
                    required
                  />
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    label="New password"
                    autoComplete="new-password"
                    required
                  />
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    label="Confirm new password"
                    autoComplete="new-password"
                    required
                  />
                  <Button
                    type="submit"
                    loading={submittingIntent === "password" && isSubmitting}
                    className="w-full"
                  >
                    Update password
                  </Button>
                </Form>
              </div>

              {/* Two-factor authentication */}
              <div className="rounded-lg p-6" style={cardStyle}>
                <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--color-text)" }}>
                  Two-factor authentication
                </h2>
                <p className="text-xs mb-4" style={{ color: "var(--color-text-faint)" }}>
                  Add a second layer of security to your account.
                </p>
                <div className="flex flex-col gap-3">
                  <div
                    className="rounded-md p-4 flex items-center justify-between gap-3"
                    style={{
                      background: "var(--color-bg-elev-2)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                        Authenticator app
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-text-faint)" }}>
                        Use Google Authenticator, Authy, or similar.
                      </p>
                    </div>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: "var(--color-bg-elev-1)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text-faint)",
                      }}
                    >
                      Coming soon
                    </span>
                  </div>
                  <div
                    className="rounded-md p-4 flex items-center justify-between gap-3"
                    style={{
                      background: "var(--color-bg-elev-2)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                        SMS / phone number
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-text-faint)" }}>
                        Receive a code via text message.
                      </p>
                    </div>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: "var(--color-bg-elev-1)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text-faint)",
                      }}
                    >
                      Coming soon
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Connected Accounts tab ── */}
          {activeTab === "connected" && (
            <div className="rounded-lg p-6" style={cardStyle}>
              <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--color-text)" }}>
                Connected accounts
              </h2>
              <p className="text-xs mb-4" style={{ color: "var(--color-text-faint)" }}>
                Link third-party accounts to unlock features like verified streamer status.
              </p>
              <div
                className="rounded-md p-4 flex items-center justify-between gap-3"
                style={{
                  background: "var(--color-bg-elev-2)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center rounded-md flex-shrink-0"
                    style={{
                      width: 36,
                      height: 36,
                      background: "#9146FF22",
                      border: "1px solid #9146FF44",
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="#9146FF"
                      aria-hidden="true"
                    >
                      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                      Twitch
                    </p>
                    <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                      Required for verified streamer badge.
                    </p>
                  </div>
                </div>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: "var(--color-bg-elev-1)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-faint)",
                  }}
                >
                  Coming soon
                </span>
              </div>
            </div>
          )}
        </div>
      </AppShell>
      <Footer />
    </div>
  );
}

function AvatarUpload({
  currentUrl,
  displayName,
}: { currentUrl?: string | null; displayName: string }) {
  const [url, setUrl] = useState(currentUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/avatar", { method: "POST", body: fd });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setError(json.error ?? "Upload failed");
      } else {
        setUrl(json.url);
      }
    } catch {
      setError("Upload failed. Check your connection.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
        Profile picture
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <div className="flex items-center gap-4">
        {url ? (
          <img
            src={url}
            alt={displayName}
            className="rounded-full object-cover flex-shrink-0"
            style={{ width: 64, height: 64, border: "1px solid var(--color-border)" }}
          />
        ) : (
          <div
            className="flex items-center justify-center rounded-full flex-shrink-0 text-sm font-semibold select-none"
            style={{
              width: 64,
              height: 64,
              background: "var(--color-bg-elev-2)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-dim)",
            }}
          >
            {initials}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="px-3 py-1.5 text-sm rounded-md transition-colors"
            style={{
              background: "var(--color-bg-elev-2)",
              border: "1px solid var(--color-border)",
              color: uploading ? "var(--color-text-faint)" : "var(--color-text)",
              cursor: uploading ? "not-allowed" : "pointer",
            }}
          >
            {uploading ? "Uploading…" : url ? "Change picture" : "Upload picture"}
          </button>
          <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
            PNG, JPG or WebP · Max 2 MB · Transparent background supported
          </p>
        </div>
      </div>
      {error && (
        <p className="text-xs" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
