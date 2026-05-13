import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import type { SerializeFrom } from "@remix-run/cloudflare";
import {
  Form,
  Link,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "@remix-run/react";
import { eq } from "drizzle-orm";
import { useRef, useState } from "react";
import QRCode from "react-qr-code";
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
import { generateTotpSecret, getOtpAuthUri, verifyTotp } from "~/lib/auth/totp";
import { getCurrentUser, requireUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { users } from "../../db/schema";

export const meta: MetaFunction = () => [{ title: "Account settings — CORE" }];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const user = requireUser(await getCurrentUser(request, env));
  const db = createDb(env.DB);
  const full = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: {
      id: true,
      handle: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      email: true,
      totpEnabled: true,
      twitchUsername: true,
      twitchLinkedAt: true,
      twitchUrl: true,
      gifAvatarUnlocked: true,
      notifyOnPostComment: true,
      notifyOnPostUpvote: true,
      notifyOnCommentReply: true,
      notifyOnCommentLike: true,
    },
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
    const twitchUrl = (form.get("twitchUrl") as string | null)?.trim() ?? "";

    if (!displayName || displayName.length < 1 || displayName.length > 64)
      return { error: "Display name must be 1–64 characters.", intent };

    if (twitchUrl) {
      const match = twitchUrl.match(/^https?:\/\/(www\.)?twitch\.tv\/([a-zA-Z0-9_]{3,25})\/?$/i);
      if (!match) return { error: "Twitch URL must be in the format twitch.tv/username.", intent };
      const urlUsername = match[2].toLowerCase();

      if (!user.isPlatformAdmin) {
        const full = await db.query.users.findFirst({
          where: eq(users.id, user.id),
          columns: { twitchUsername: true },
        });
        if (!full?.twitchUsername) {
          return {
            error: "Connect your Twitch account first before adding a Twitch link.",
            intent,
          };
        }
        if (urlUsername !== full.twitchUsername.toLowerCase()) {
          return {
            error: `Twitch link must match your linked Twitch account (@${full.twitchUsername}).`,
            intent,
          };
        }
      }
    }

    await db
      .update(users)
      .set({ displayName, bio: bio || null, twitchUrl: twitchUrl || null, updatedAt: new Date() })
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

  if (intent === "2fa_start") {
    const secret = generateTotpSecret();
    await env.KV.put(`totp_setup:${user.id}`, secret, { expirationTtl: 300 });
    const full = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: { handle: true },
    });
    const uri = getOtpAuthUri(secret, full?.handle ?? user.id);
    return { intent, secret, uri };
  }

  if (intent === "2fa_confirm") {
    const code = (form.get("code") as string | null)?.replace(/\s/g, "") ?? "";
    const secret = await env.KV.get(`totp_setup:${user.id}`);
    if (!secret) return { error: "Setup session expired. Start again.", intent };

    const valid = await verifyTotp(secret, code);
    if (!valid) return { error: "Incorrect code. Try again.", intent };

    await db
      .update(users)
      .set({ totpSecret: secret, totpEnabled: true, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await env.KV.delete(`totp_setup:${user.id}`);
    return { ok: true, intent };
  }

  if (intent === "2fa_disable") {
    const code = (form.get("code") as string | null)?.replace(/\s/g, "") ?? "";
    const password = (form.get("password") as string | null) ?? "";
    const row = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: { totpSecret: true, totpEnabled: true, passwordHash: true },
    });
    if (!row?.totpEnabled) return { error: "2FA is not enabled.", intent };

    // Accept either a valid TOTP code or the account password
    const totpValid = row.totpSecret ? await verifyTotp(row.totpSecret, code) : false;
    const passwordValid = password ? await verifyPassword(password, row.passwordHash) : false;
    if (!totpValid && !passwordValid) {
      return { error: "Incorrect code or password.", intent };
    }

    await db
      .update(users)
      .set({ totpSecret: null, totpEnabled: false, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    return { ok: true, intent };
  }

  if (intent === "notifications") {
    const notifyOnPostComment = form.get("notifyOnPostComment") === "on";
    const notifyOnPostUpvote = form.get("notifyOnPostUpvote") === "on";
    const notifyOnCommentReply = form.get("notifyOnCommentReply") === "on";
    const notifyOnCommentLike = form.get("notifyOnCommentLike") === "on";
    await db
      .update(users)
      .set({
        notifyOnPostComment,
        notifyOnPostUpvote,
        notifyOnCommentReply,
        notifyOnCommentLike,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
    return { ok: true, intent };
  }

  if (intent === "twitch_disconnect") {
    await db
      .update(users)
      .set({
        twitchId: null,
        twitchUsername: null,
        twitchLinkedAt: null,
        twitchUrl: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
    return { ok: true, intent };
  }

  return { error: "Unknown action.", intent };
}

type LoaderData = SerializeFrom<typeof loader>;

export default function SettingsPage() {
  const { user } = useLoaderData<typeof loader>();
  const data = useActionData<typeof action>();
  const nav = useNavigation();
  const [params, setParams] = useSearchParams();

  const isSubmitting = nav.state === "submitting";
  const submittingIntent =
    nav.state === "submitting" ? ((nav.formData?.get("_intent") as string | null) ?? "") : null;

  const activeTab = (params.get("tab") ?? "profile") as
    | "profile"
    | "security"
    | "connected"
    | "notifications";
  const TABS = [
    { id: "profile" as const, label: "Profile" },
    { id: "security" as const, label: "Security" },
    { id: "connected" as const, label: "Connected" },
    { id: "notifications" as const, label: "Notifications" },
  ];

  const profileOk = data && "ok" in data && data.ok && data.intent === "profile";
  const passwordOk = data && "ok" in data && data.ok && data.intent === "password";
  const notifOk = data && "ok" in data && data.ok && data.intent === "notifications";
  const errorMsg = data && "error" in data ? data.error : null;

  const twitchOk = params.get("twitch_ok") === "1";
  const twitchError = params.get("twitch_error");

  const cardStyle = {
    background: "var(--color-bg-elev-1)",
    border: "1px solid var(--color-border)",
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header user={user} />
      <div className="flex-1 py-8 px-4">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">
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
          {errorMsg &&
            !["2fa_start", "2fa_confirm", "2fa_disable"].includes(
              (data as { intent?: string })?.intent ?? "",
            ) && <Alert variant="error">{errorMsg}</Alert>}

          {/* ── Profile tab ── */}
          {activeTab === "profile" && (
            <div className="rounded-lg p-6" style={cardStyle}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text)" }}>
                Profile
              </h2>
              <Form method="post" className="flex flex-col gap-4">
                <input type="hidden" name="_intent" value="profile" />
                <AvatarUpload
                  currentUrl={user.avatarUrl}
                  displayName={user.displayName}
                  gifAvatarUnlocked={user.gifAvatarUnlocked}
                />
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
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="twitchUrl"
                    className="text-sm font-medium"
                    style={{ color: "var(--color-text)" }}
                  >
                    Twitch link
                  </label>
                  <Input
                    id="twitchUrl"
                    name="twitchUrl"
                    type="url"
                    placeholder="https://twitch.tv/yourusername"
                    defaultValue={user.twitchUrl ?? ""}
                    hint={
                      user.twitchUsername
                        ? `Must be twitch.tv/${user.twitchUsername}`
                        : "Connect your Twitch account first to set a Twitch link."
                    }
                  />
                </div>
                {errorMsg && (data as { intent?: string })?.intent === "profile" && (
                  <Alert variant="error">{errorMsg}</Alert>
                )}
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
                  {errorMsg && (data as { intent?: string })?.intent === "password" && (
                    <Alert variant="error">{errorMsg}</Alert>
                  )}
                  <Button
                    type="submit"
                    loading={submittingIntent === "password" && isSubmitting}
                    className="w-full"
                  >
                    Update password
                  </Button>
                </Form>
              </div>

              <TotpSection user={user} />
            </div>
          )}

          {/* ── Notifications tab ── */}
          {activeTab === "notifications" && (
            <div className="rounded-lg p-6" style={cardStyle}>
              <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--color-text)" }}>
                Notification preferences
              </h2>
              <p className="text-xs mb-5" style={{ color: "var(--color-text-faint)" }}>
                Choose which activity sends you a notification.
              </p>
              <Form method="post" className="flex flex-col gap-5">
                <input type="hidden" name="_intent" value="notifications" />
                <NotifToggleRow
                  name="notifyOnPostComment"
                  label="Comments on my posts"
                  description="When someone comments on a post you made"
                  defaultChecked={user.notifyOnPostComment ?? true}
                />
                <NotifToggleRow
                  name="notifyOnPostUpvote"
                  label="Upvotes on my posts"
                  description="When someone upvotes a post you made"
                  defaultChecked={user.notifyOnPostUpvote ?? true}
                />
                <NotifToggleRow
                  name="notifyOnCommentReply"
                  label="Replies to my comments"
                  description="When someone replies directly to your comment"
                  defaultChecked={user.notifyOnCommentReply ?? true}
                />
                <NotifToggleRow
                  name="notifyOnCommentLike"
                  label="Likes on my comments"
                  description="When someone likes a comment you made"
                  defaultChecked={user.notifyOnCommentLike ?? true}
                />
                {notifOk && <Alert variant="success">Preferences saved.</Alert>}
                <Button
                  type="submit"
                  loading={submittingIntent === "notifications" && isSubmitting}
                  className="w-full"
                >
                  Save preferences
                </Button>
              </Form>
            </div>
          )}

          {/* ── Connected Accounts tab ── */}
          {activeTab === "connected" && (
            <div className="rounded-lg p-6" style={cardStyle}>
              <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--color-text)" }}>
                Connected accounts
              </h2>
              <p className="text-xs mb-4" style={{ color: "var(--color-text-faint)" }}>
                Linking your Twitch account lets you add a verified Twitch link to your profile and
                apply for streamer status.
              </p>

              {twitchOk && (
                <Alert variant="success" className="mb-3">
                  Twitch connected successfully.
                </Alert>
              )}
              {twitchError === "1" && (
                <Alert variant="error" className="mb-3">
                  Twitch connection failed. Please try again.
                </Alert>
              )}
              {twitchError === "taken" && (
                <Alert variant="error" className="mb-3">
                  That Twitch account is already linked to another CORE account.
                </Alert>
              )}

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
                    {user.twitchUsername ? (
                      <p className="text-xs" style={{ color: "var(--color-success)" }}>
                        Connected as @{user.twitchUsername}
                      </p>
                    ) : (
                      <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                        Not connected
                      </p>
                    )}
                  </div>
                </div>

                {user.twitchUsername ? (
                  <Form method="post">
                    <input type="hidden" name="_intent" value="twitch_disconnect" />
                    <button
                      type="submit"
                      className="text-xs px-3 py-1.5 rounded-md"
                      style={{
                        background: "var(--color-bg-elev-1)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-danger)",
                        cursor: "pointer",
                      }}
                    >
                      Disconnect
                    </button>
                  </Form>
                ) : (
                  <Link
                    to="/auth/twitch"
                    className="text-xs px-3 py-1.5 rounded-md no-underline"
                    style={{
                      background: "#9146FF",
                      color: "#fff",
                    }}
                  >
                    Connect Twitch
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}

function TotpSection({ user }: { user: LoaderData["user"] }) {
  const fetcher = useFetcher<{
    intent?: string;
    secret?: string;
    uri?: string;
    ok?: boolean;
    error?: string;
  }>();
  const [step, setStep] = useState<"idle" | "setup" | "disable">("idle");

  const startData = fetcher.data?.intent === "2fa_start" ? fetcher.data : null;
  const confirmOk = fetcher.data?.intent === "2fa_confirm" && fetcher.data?.ok;
  const disableOk = fetcher.data?.intent === "2fa_disable" && fetcher.data?.ok;
  const err = fetcher.data && "error" in fetcher.data ? fetcher.data.error : null;

  const isEnabled = user.totpEnabled && !disableOk;

  return (
    <div
      className="rounded-lg p-6"
      style={{ background: "var(--color-bg-elev-1)", border: "1px solid var(--color-border)" }}
    >
      <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--color-text)" }}>
        Two-factor authentication
      </h2>
      <p className="text-xs mb-4" style={{ color: "var(--color-text-faint)" }}>
        Use an authenticator app (Google Authenticator, Authy, 1Password, etc.) for an extra layer
        of security.
      </p>

      {err && (
        <Alert variant="error" className="mb-3">
          {err}
        </Alert>
      )}
      {confirmOk && (
        <Alert variant="success" className="mb-3">
          2FA enabled successfully.
        </Alert>
      )}
      {disableOk && (
        <Alert variant="success" className="mb-3">
          2FA disabled.
        </Alert>
      )}

      {!isEnabled && step === "idle" && !confirmOk && (
        <button
          type="button"
          onClick={() => {
            setStep("setup");
            fetcher.submit({ _intent: "2fa_start" }, { method: "post" });
          }}
          className="px-4 py-2 text-sm rounded-md"
          style={{
            background: "var(--color-text)",
            color: "var(--color-bg)",
            border: "none",
            cursor: "pointer",
          }}
        >
          Set up authenticator app
        </button>
      )}

      {step === "setup" && !confirmOk && (
        <div className="flex flex-col gap-4">
          {startData?.uri ? (
            <>
              <p className="text-xs" style={{ color: "var(--color-text-dim)" }}>
                Scan this QR code with your authenticator app, or tap the link below on mobile.
              </p>
              <div className="p-4 rounded-md self-start" style={{ background: "#fff" }}>
                <QRCode value={startData.uri} size={160} bgColor="#ffffff" fgColor="#000000" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                  Or enter this key manually:
                </p>
                <code
                  className="text-xs px-3 py-2 rounded-md font-mono tracking-widest select-all"
                  style={{
                    background: "var(--color-bg-elev-2)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                >
                  {startData.secret}
                </code>
              </div>
              <a
                href={startData.uri}
                className="text-xs"
                style={{ color: "var(--color-text-faint)" }}
              >
                Open in authenticator app →
              </a>
              <fetcher.Form method="post" className="flex flex-col gap-3">
                <input type="hidden" name="_intent" value="2fa_confirm" />
                <Input
                  id="totpCode"
                  name="code"
                  type="text"
                  label="Enter 6-digit code to confirm"
                  placeholder="123 456"
                  inputMode="numeric"
                  maxLength={7}
                  autoComplete="one-time-code"
                  required
                />
                <div className="flex gap-2">
                  <Button type="submit" loading={fetcher.state !== "idle"}>
                    Confirm &amp; enable
                  </Button>
                  <button
                    type="button"
                    onClick={() => setStep("idle")}
                    className="px-4 py-2 text-sm rounded-md"
                    style={{
                      color: "var(--color-text-dim)",
                      border: "1px solid var(--color-border)",
                      background: "none",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </fetcher.Form>
            </>
          ) : (
            <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
              {fetcher.state !== "idle" ? "Generating…" : "Something went wrong. Try again."}
            </p>
          )}
        </div>
      )}

      {isEnabled && step !== "disable" && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: "var(--color-success)" }} />
            <p className="text-sm" style={{ color: "var(--color-text)" }}>
              Authenticator app enabled
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStep("disable")}
            className="text-xs px-3 py-1.5 rounded-md"
            style={{
              background: "var(--color-bg-elev-2)",
              border: "1px solid var(--color-border)",
              color: "var(--color-danger)",
              cursor: "pointer",
            }}
          >
            Disable
          </button>
        </div>
      )}

      {isEnabled && step === "disable" && (
        <fetcher.Form method="post" className="flex flex-col gap-3">
          <input type="hidden" name="_intent" value="2fa_disable" />
          <Input
            id="disableCode"
            name="code"
            type="text"
            label="6-digit authenticator code"
            placeholder="123 456"
            inputMode="numeric"
            maxLength={7}
            autoComplete="one-time-code"
          />
          <p className="text-xs text-center" style={{ color: "var(--color-text-faint)" }}>
            — or, if you no longer have access to the app —
          </p>
          <Input
            id="disablePassword"
            name="password"
            type="password"
            label="Account password"
            placeholder="Your current password"
            autoComplete="current-password"
          />
          <div className="flex gap-2">
            <Button type="submit" loading={fetcher.state !== "idle"}>
              Disable 2FA
            </Button>
            <button
              type="button"
              onClick={() => setStep("idle")}
              className="px-4 py-2 text-sm rounded-md"
              style={{
                color: "var(--color-text-dim)",
                border: "1px solid var(--color-border)",
                background: "none",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </fetcher.Form>
      )}
    </div>
  );
}

function AvatarUpload({
  currentUrl,
  displayName,
  gifAvatarUnlocked,
}: {
  currentUrl?: string | null;
  displayName: string;
  gifAvatarUnlocked: boolean;
}) {
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

  const accept = gifAvatarUnlocked
    ? "image/png,image/jpeg,image/webp,image/gif"
    : "image/png,image/jpeg,image/webp";

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
        accept={accept}
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
          {gifAvatarUnlocked ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium" style={{ color: "var(--color-success)" }}>
                Animated GIF avatars unlocked
              </span>
              <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                PNG, JPG, WebP or GIF · Max 5 MB for GIFs, 2 MB for others
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                PNG, JPG or WebP · Max 2 MB
              </p>
              <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                Spend $50 on Core Coins to unlock animated GIF avatars
              </p>
            </div>
          )}
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

function NotifToggleRow({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <label
      className="flex items-start justify-between gap-6 cursor-pointer"
      style={{ color: "var(--color-text)" }}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
          {label}
        </span>
        <span className="text-xs" style={{ color: "var(--color-text-faint)" }}>
          {description}
        </span>
      </div>
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 flex-shrink-0"
        style={{ accentColor: "var(--color-text)", width: 16, height: 16, cursor: "pointer" }}
      />
    </label>
  );
}
