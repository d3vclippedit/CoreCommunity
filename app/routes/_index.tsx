import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { Link, useLoaderData, useRouteLoaderData } from "@remix-run/react";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { getLiveStreams } from "~/lib/twitch/client.server";
import { type StreamStatus, formatViewers } from "~/lib/twitch/shared";
import type { loader as rootLoader } from "~/root";

export const meta: MetaFunction = () => [
  { title: "CORE — Communities for creators who actually run them" },
  {
    name: "description",
    content:
      "CORE is a creator-owned community platform — Reddit-style discoverable forums built specifically for streamers and the people around them.",
  },
  { property: "og:title", content: "CORE" },
  { property: "og:description", content: "Communities for creators who actually run them." },
  { property: "og:type", content: "website" },
];

export async function loader({ context }: LoaderFunctionArgs) {
  const env = context.cloudflare.env as unknown as {
    KV: KVNamespace;
    DB: D1Database;
    TWITCH_CLIENT_ID?: string;
    TWITCH_CLIENT_SECRET?: string;
  };
  const streams = await getLiveStreams(
    env.KV,
    env.DB,
    env.TWITCH_CLIENT_ID,
    env.TWITCH_CLIENT_SECRET,
  );
  return { streams };
}

export default function Index() {
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const { streams } = useLoaderData<typeof loader>();
  const user = root?.user ?? null;

  const liveStreams = streams.filter((s) => s.isLive);
  const totalViewers = liveStreams.reduce((sum, s) => sum + s.viewerCount, 0);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header user={user} />

      <AppShell rightRail={<LiveTrackerWidget streams={streams} totalViewers={totalViewers} />}>
        <div className="flex flex-col items-start gap-10 py-16 md:py-24">
          {/* Hero */}
          <div className="max-w-2xl">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6"
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
              Early access — building in public
            </div>

            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-display tracking-tight mb-6 leading-[1.08]"
              style={{ color: "var(--color-text)" }}
            >
              Communities for creators
              <br />
              <span style={{ color: "var(--color-text-dim)" }}>who actually run them.</span>
            </h1>

            <p
              className="text-lg leading-relaxed mb-8 max-w-xl"
              style={{ color: "var(--color-text-dim)" }}
            >
              A creator-owned community platform — forum-style discussion, threaded posts, voting,
              and real moderation tools. Built for streamers and the people around them.
            </p>

            <div className="flex items-center gap-3 flex-wrap">
              <Link
                to="/communities"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold no-underline transition-opacity hover:opacity-80"
                style={{ background: "var(--color-text)", color: "var(--color-bg)" }}
              >
                Browse communities
              </Link>
              <Link
                to="/auth/signup"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium no-underline transition-colors"
                style={{
                  background: "var(--color-bg-elev-1)",
                  color: "var(--color-text)",
                  border: "1px solid var(--color-border)",
                }}
              >
                Create account
              </Link>
            </div>
          </div>

          {/* Feature callouts */}
          <div
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mt-4"
            style={{ maxWidth: "680px" }}
          >
            {[
              {
                label: "Creator-owned",
                description: "Streamers run their own community. Not a server admin. An owner.",
              },
              {
                label: "Discoverable",
                description: "Forum-style, indexed, identity-bearing. Not ephemeral chat.",
              },
              {
                label: "Actually moderated",
                description: "Roles, mod queues, audit logs, and ban tools that actually work.",
              },
            ].map((f) => (
              <div
                key={f.label}
                className="rounded-lg p-4"
                style={{
                  background: "var(--color-bg-elev-1)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <p className="text-sm font-semibold mb-1" style={{ color: "var(--color-text)" }}>
                  {f.label}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-dim)" }}>
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </AppShell>

      <Footer />
    </div>
  );
}

function LiveTrackerWidget({
  streams,
  totalViewers,
}: {
  streams: StreamStatus[];
  totalViewers: number;
}) {
  const liveCount = streams.filter((s) => s.isLive).length;

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: "var(--color-bg-elev-1)",
        border: "1px solid var(--color-border)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--color-text-faint)" }}
          >
            CORE
          </span>
          {liveCount > 0 && (
            <span
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
              style={{ background: "rgba(61,214,140,0.12)", color: "var(--color-success)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {liveCount} live
            </span>
          )}
        </div>
        {totalViewers > 0 && (
          <span className="text-xs" style={{ color: "var(--color-text-faint)" }}>
            {formatViewers(totalViewers)} watching
          </span>
        )}
      </div>

      {/* Streamer list */}
      <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
        {[...streams]
          .sort((a, b) => (b.isLive ? 1 : 0) - (a.isLive ? 1 : 0) || b.viewerCount - a.viewerCount)
          .map((s) => (
            <StreamerRow key={s.login} stream={s} />
          ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5" style={{ borderTop: "1px solid var(--color-border)" }}>
        <Link
          to="/stats"
          className="text-xs no-underline hover:underline"
          style={{ color: "var(--color-text-faint)" }}
        >
          Stream stats →
        </Link>
      </div>
    </div>
  );
}

function StreamerRow({ stream }: { stream: StreamStatus }) {
  return (
    <div className="px-4 py-3 flex items-start gap-3">
      {/* Live indicator */}
      <div className="pt-0.5 flex-shrink-0">
        <span
          className="w-2 h-2 rounded-full block"
          style={{
            background: stream.isLive ? "var(--color-success)" : "var(--color-bg-elev-2)",
            border: stream.isLive ? undefined : "1px solid var(--color-border)",
          }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <a
            href={`https://www.twitch.tv/${stream.login}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium no-underline hover:underline truncate"
            style={{ color: stream.isLive ? "var(--color-text)" : "var(--color-text-faint)" }}
          >
            {stream.display}
          </a>
          {stream.isLive && (
            <span
              className="text-xs font-semibold flex-shrink-0 tabular-nums"
              style={{ color: "var(--color-text-dim)" }}
            >
              {formatViewers(stream.viewerCount)}
            </span>
          )}
        </div>
        {stream.isLive && stream.gameName && (
          <p className="text-xs truncate mt-0.5" style={{ color: "var(--color-text-faint)" }}>
            {stream.gameName}
          </p>
        )}
        {!stream.isLive && (
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-faint)" }}>
            Offline
          </p>
        )}
      </div>
    </div>
  );
}
