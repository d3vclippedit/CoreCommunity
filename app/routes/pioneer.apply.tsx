import type { ActionFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Form, Link, useActionData, useNavigation } from "@remix-run/react";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { checkRateLimit } from "~/lib/ratelimit";
import { generateId } from "~/lib/utils";
import { pioneerApplications } from "../../db/schema";

export const meta: MetaFunction = () => [
  { title: "Become a Cormunities Pioneer — CORE" },
  {
    name: "description",
    content:
      "Apply to be a Cormunities Pioneer — get early access, founding-creator status, and your own community on CORE.",
  },
];

export async function loader({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  return { user };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);

  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const rl = await checkRateLimit(env.KV, "pioneer_apply", ip, 3, 3600);
  if (!rl.allowed) return { error: "Too many applications from this IP. Try again later." };

  const form = await request.formData();

  const name = (form.get("name") as string | null)?.trim() ?? "";
  const email = (form.get("email") as string | null)?.trim().toLowerCase() ?? "";
  const coreHandle = (form.get("coreHandle") as string | null)?.trim().toLowerCase() || null;
  const twitchHandle = (form.get("twitchHandle") as string | null)?.trim().toLowerCase() || null;
  const youtubeHandle = (form.get("youtubeHandle") as string | null)?.trim() || null;
  const kickHandle = (form.get("kickHandle") as string | null)?.trim().toLowerCase() || null;
  const twitchFollowers = Number(form.get("twitchFollowers") ?? 0) || null;
  const youtubeSubscribers = Number(form.get("youtubeSubscribers") ?? 0) || null;
  const kickFollowers = Number(form.get("kickFollowers") ?? 0) || null;
  const avgViewers = Number(form.get("avgViewers") ?? 0) || null;
  const communityName = (form.get("communityName") as string | null)?.trim() || null;
  const contentNiche = (form.get("contentNiche") as string | null)?.trim() || null;
  const whyPioneer = (form.get("whyPioneer") as string | null)?.trim() ?? "";
  const sampleLinks = (form.get("sampleLinks") as string | null)?.trim() || null;

  if (!name) return { error: "Full name is required." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "A valid email is required." };
  if (!twitchHandle && !youtubeHandle && !kickHandle)
    return { error: "At least one platform handle is required." };
  if (!whyPioneer || whyPioneer.length < 50)
    return { error: "Please write at least 50 characters for your pitch." };

  const db = createDb(env.DB);
  const now = new Date();

  await db.insert(pioneerApplications).values({
    id: generateId(),
    userId: user?.id ?? null,
    name,
    email,
    coreHandle,
    twitchHandle,
    youtubeHandle,
    kickHandle,
    twitchFollowers,
    youtubeSubscribers,
    kickFollowers,
    avgViewers,
    communityName,
    contentNiche,
    whyPioneer,
    sampleLinks,
    status: "pending",
    adminNote: null,
    reviewedByAdminId: null,
    createdAt: now,
    updatedAt: now,
  });

  return { ok: true };
}

const inputCls = "w-full rounded-md px-3 py-2.5 text-sm outline-none";
const inputStyle = {
  background: "var(--color-bg-elev-2)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
} as const;

const labelCls = "block text-xs font-medium mb-1.5";
const labelStyle = { color: "var(--color-text-dim)" } as const;

const sectionHeadingCls = "text-sm font-semibold mb-4 pb-2";
const sectionHeadingStyle = {
  color: "var(--color-text)",
  borderBottom: "1px solid var(--color-border)",
} as const;

export default function PioneerApplyPage() {
  const ad = useActionData<typeof action>();
  const nav = useNavigation();
  const submitting = nav.state === "submitting";

  if (ad && "ok" in ad) {
    return (
      <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
        <Header user={null} />
        <AppShell>
          <div className="py-16 max-w-xl mx-auto text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl mx-auto mb-6"
              style={{
                background: "var(--color-bg-elev-1)",
                border: "1px solid var(--color-border)",
              }}
            >
              🎉
            </div>
            <h1 className="text-2xl font-semibold mb-3" style={{ color: "var(--color-text)" }}>
              Application received!
            </h1>
            <p className="text-sm leading-relaxed mb-8" style={{ color: "var(--color-text-dim)" }}>
              Thanks for applying to the Cormunities Pioneer programme. We review every application
              personally and will be in touch via email within a few days.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold no-underline transition-opacity hover:opacity-80"
              style={{ background: "var(--color-text)", color: "var(--color-bg)" }}
            >
              Back to home
            </Link>
          </div>
        </AppShell>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header user={null} />
      <AppShell>
        <div className="py-10 max-w-2xl">
          {/* Header */}
          <div className="mb-8">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4"
              style={{
                background: "var(--color-bg-elev-2)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-dim)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "var(--color-success)" }}
              />
              Cormunities Pioneer Programme
            </div>
            <h1 className="text-3xl font-semibold mb-3" style={{ color: "var(--color-text)" }}>
              Apply to become a Pioneer
            </h1>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--color-text-dim)", maxWidth: "520px" }}
            >
              Pioneers are the founding creators of CORE — they get early access, a verified badge,
              and help shape the platform. We review every application personally.
            </p>
          </div>

          {ad && "error" in ad && (
            <div
              className="rounded-md px-4 py-3 mb-6 text-sm"
              style={{
                background: "rgba(229,72,77,0.08)",
                border: "1px solid var(--color-danger)",
                color: "var(--color-danger)",
              }}
            >
              {ad.error}
            </div>
          )}

          <Form method="post" className="flex flex-col gap-8">
            {/* Section: About you */}
            <div
              className="rounded-lg p-6"
              style={{
                background: "var(--color-bg-elev-1)",
                border: "1px solid var(--color-border)",
              }}
            >
              <h2 className={sectionHeadingCls} style={sectionHeadingStyle}>
                About you
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls} style={labelStyle} htmlFor="name">
                    Full name <span style={{ color: "var(--color-danger)" }}>*</span>
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="Your real name"
                    required
                    autoComplete="name"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className={labelCls} style={labelStyle} htmlFor="email">
                    Email address <span style={{ color: "var(--color-danger)" }}>*</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls} style={labelStyle} htmlFor="coreHandle">
                    CORE handle{" "}
                    <span style={{ color: "var(--color-text-faint)" }}>
                      (if you have an account)
                    </span>
                  </label>
                  <div className="relative">
                    <span
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none"
                      style={{ color: "var(--color-text-faint)" }}
                    >
                      @
                    </span>
                    <input
                      id="coreHandle"
                      name="coreHandle"
                      type="text"
                      placeholder="yourhandle"
                      autoComplete="off"
                      className={inputCls}
                      style={{ ...inputStyle, paddingLeft: "1.75rem" }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Your platforms */}
            <div
              className="rounded-lg p-6"
              style={{
                background: "var(--color-bg-elev-1)",
                border: "1px solid var(--color-border)",
              }}
            >
              <h2 className={sectionHeadingCls} style={sectionHeadingStyle}>
                Your platforms{" "}
                <span className="text-xs font-normal" style={{ color: "var(--color-text-faint)" }}>
                  — fill in at least one
                </span>
              </h2>

              {/* Twitch */}
              <div className="mb-5">
                <p
                  className="text-xs font-semibold mb-3"
                  style={{ color: "var(--color-text-dim)" }}
                >
                  Twitch
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls} style={labelStyle} htmlFor="twitchHandle">
                      Channel name
                    </label>
                    <div className="relative">
                      <span
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
                        style={{ color: "var(--color-text-faint)" }}
                      >
                        twitch.tv/
                      </span>
                      <input
                        id="twitchHandle"
                        name="twitchHandle"
                        type="text"
                        placeholder="yourchannel"
                        autoComplete="off"
                        className={inputCls}
                        style={{ ...inputStyle, paddingLeft: "4.5rem" }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls} style={labelStyle} htmlFor="twitchFollowers">
                      Followers
                    </label>
                    <input
                      id="twitchFollowers"
                      name="twitchFollowers"
                      type="number"
                      placeholder="e.g. 5000"
                      min={0}
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>

              {/* YouTube */}
              <div className="mb-5">
                <p
                  className="text-xs font-semibold mb-3"
                  style={{ color: "var(--color-text-dim)" }}
                >
                  YouTube
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls} style={labelStyle} htmlFor="youtubeHandle">
                      Channel handle or URL
                    </label>
                    <input
                      id="youtubeHandle"
                      name="youtubeHandle"
                      type="text"
                      placeholder="@yourchannel or full URL"
                      autoComplete="off"
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className={labelCls} style={labelStyle} htmlFor="youtubeSubscribers">
                      Subscribers
                    </label>
                    <input
                      id="youtubeSubscribers"
                      name="youtubeSubscribers"
                      type="number"
                      placeholder="e.g. 12000"
                      min={0}
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>

              {/* Kick */}
              <div className="mb-5">
                <p
                  className="text-xs font-semibold mb-3"
                  style={{ color: "var(--color-text-dim)" }}
                >
                  Kick
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls} style={labelStyle} htmlFor="kickHandle">
                      Channel name
                    </label>
                    <div className="relative">
                      <span
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
                        style={{ color: "var(--color-text-faint)" }}
                      >
                        kick.com/
                      </span>
                      <input
                        id="kickHandle"
                        name="kickHandle"
                        type="text"
                        placeholder="yourchannel"
                        autoComplete="off"
                        className={inputCls}
                        style={{ ...inputStyle, paddingLeft: "4.25rem" }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls} style={labelStyle} htmlFor="kickFollowers">
                      Followers
                    </label>
                    <input
                      id="kickFollowers"
                      name="kickFollowers"
                      type="number"
                      placeholder="e.g. 2000"
                      min={0}
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>

              {/* Avg viewers */}
              <div>
                <label className={labelCls} style={labelStyle} htmlFor="avgViewers">
                  Average concurrent viewers{" "}
                  <span style={{ color: "var(--color-text-faint)" }}>(across all platforms)</span>
                </label>
                <input
                  id="avgViewers"
                  name="avgViewers"
                  type="number"
                  placeholder="e.g. 150"
                  min={0}
                  className={inputCls}
                  style={{ ...inputStyle, maxWidth: "200px" }}
                />
              </div>
            </div>

            {/* Section: Your community */}
            <div
              className="rounded-lg p-6"
              style={{
                background: "var(--color-bg-elev-1)",
                border: "1px solid var(--color-border)",
              }}
            >
              <h2 className={sectionHeadingCls} style={sectionHeadingStyle}>
                Your community
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={labelCls} style={labelStyle} htmlFor="communityName">
                    Community name{" "}
                    <span style={{ color: "var(--color-text-faint)" }}>(what you'd call it)</span>
                  </label>
                  <input
                    id="communityName"
                    name="communityName"
                    type="text"
                    placeholder="e.g. Arky's Lair"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className={labelCls} style={labelStyle} htmlFor="contentNiche">
                    Content niche
                  </label>
                  <select
                    id="contentNiche"
                    name="contentNiche"
                    className={inputCls}
                    style={inputStyle}
                  >
                    <option value="">Select a niche…</option>
                    <option value="fps">FPS / Competitive Gaming</option>
                    <option value="mmo">MMO / RPG</option>
                    <option value="variety">Variety Gaming</option>
                    <option value="irl">IRL / Just Chatting</option>
                    <option value="art">Art / Creative</option>
                    <option value="music">Music / DJing</option>
                    <option value="sports">Sports / Fitness</option>
                    <option value="esports">Esports / Commentary</option>
                    <option value="tech">Tech / Programming</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label className={labelCls} style={labelStyle} htmlFor="whyPioneer">
                  Why should you be a Cormunities Pioneer?{" "}
                  <span style={{ color: "var(--color-danger)" }}>*</span>
                  <span className="font-normal ml-1" style={{ color: "var(--color-text-faint)" }}>
                    (min. 50 characters)
                  </span>
                </label>
                <textarea
                  id="whyPioneer"
                  name="whyPioneer"
                  rows={5}
                  placeholder="Tell us about your community, what makes it unique, why you're a good fit for an early-access platform, and what you'd build here."
                  required
                  minLength={50}
                  className={inputCls}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
              <div>
                <label className={labelCls} style={labelStyle} htmlFor="sampleLinks">
                  Links to your best content{" "}
                  <span style={{ color: "var(--color-text-faint)" }}>
                    (VODs, clips, highlights — one per line)
                  </span>
                </label>
                <textarea
                  id="sampleLinks"
                  name="sampleLinks"
                  rows={3}
                  placeholder={"https://twitch.tv/videos/...\nhttps://youtu.be/..."}
                  className={inputCls}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-md text-sm font-semibold disabled:opacity-60 transition-opacity hover:opacity-80"
                style={{ background: "var(--color-text)", color: "var(--color-bg)" }}
              >
                {submitting ? "Submitting…" : "Submit application"}
              </button>
              <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                We review every application personally and reply by email.
              </p>
            </div>
          </Form>
        </div>
      </AppShell>
      <Footer />
    </div>
  );
}
