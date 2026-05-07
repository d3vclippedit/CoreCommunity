import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData, useRouteLoaderData, useSearchParams } from "@remix-run/react";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { getLiveStreams } from "~/lib/twitch/client.server";
import { CORE_STREAMERS, type StreamStatus, formatViewers } from "~/lib/twitch/shared";
import type { loader as rootLoader } from "~/root";

export const meta: MetaFunction = () => [{ title: "Stream Stats — Cormunities" }];

type Range = "24h" | "7d" | "28d";

interface ChartPoint {
  bucket: number;
  total_viewers: number;
}

interface StreamerStat {
  streamer_login: string;
  peak_viewers: number;
  avg_viewers: number;
  hours_live: number;
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const range = (url.searchParams.get("range") ?? "7d") as Range;
  const validRanges: Range[] = ["24h", "7d", "28d"];
  const safeRange: Range = validRanges.includes(range) ? range : "7d";

  const env = context.cloudflare.env as unknown as {
    KV: KVNamespace;
    DB: D1Database;
    TWITCH_CLIENT_ID?: string;
    TWITCH_CLIENT_SECRET?: string;
  };

  const now = Math.floor(Date.now() / 1000);
  const cutoffMap: Record<Range, number> = {
    "24h": now - 86400,
    "7d": now - 7 * 86400,
    "28d": now - 28 * 86400,
  };
  const cutoff = cutoffMap[safeRange];
  const bucketSize = safeRange === "24h" ? 3600 : 86400;

  const [streams, chartResult, statsResult] = await Promise.all([
    getLiveStreams(env.KV, env.DB, env.TWITCH_CLIENT_ID, env.TWITCH_CLIENT_SECRET),
    env.DB.prepare(
      `SELECT (recorded_at / ?) * ? AS bucket, SUM(viewer_count) AS total_viewers
       FROM stream_snapshots
       WHERE is_live = 1 AND recorded_at > ?
       GROUP BY bucket
       ORDER BY bucket ASC`,
    )
      .bind(bucketSize, bucketSize, cutoff)
      .all<ChartPoint>(),
    env.DB.prepare(
      `SELECT
         streamer_login,
         MAX(viewer_count) AS peak_viewers,
         CAST(ROUND(AVG(CASE WHEN is_live = 1 THEN viewer_count ELSE NULL END)) AS INTEGER) AS avg_viewers,
         CAST(ROUND(SUM(CASE WHEN is_live = 1 THEN 300 ELSE 0 END) / 3600.0 * 10) / 10 AS REAL) AS hours_live
       FROM stream_snapshots
       WHERE recorded_at > ?
       GROUP BY streamer_login`,
    )
      .bind(cutoff)
      .all<StreamerStat>(),
  ]);

  const chartData = chartResult.results ?? [];
  const streamerStats = statsResult.results ?? [];

  // Map streamer stats by login for easy lookup
  const statsMap = new Map(streamerStats.map((s) => [s.streamer_login, s]));

  return { streams, chartData, statsMap: Object.fromEntries(statsMap), range: safeRange, now };
}

export default function Stats() {
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const { streams, chartData, statsMap, range } = useLoaderData<typeof loader>();
  const user = root?.user ?? null;
  const [, setSearchParams] = useSearchParams();

  const liveStreams = streams.filter((s) => s.isLive);
  const totalViewers = liveStreams.reduce((sum, s) => sum + s.viewerCount, 0);
  const liveCount = liveStreams.length;

  const rangeLabels: Record<Range, string> = {
    "24h": "24 hours",
    "7d": "7 days",
    "28d": "28 days",
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header user={user} />
      <AppShell>
        <div className="py-8">
          {/* Page header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <h1
                className="text-2xl font-display font-bold"
                style={{ color: "var(--color-text)" }}
              >
                Stream Stats
              </h1>
              {liveCount > 0 && (
                <span
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    background: "rgba(61,214,140,0.12)",
                    color: "var(--color-success)",
                    border: "1px solid rgba(61,214,140,0.2)",
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {liveCount} live now
                </span>
              )}
            </div>
            {totalViewers > 0 && (
              <p className="text-sm" style={{ color: "var(--color-text-faint)" }}>
                {formatViewers(totalViewers)} total viewers right now
              </p>
            )}
          </div>

          {/* Live now cards */}
          {liveStreams.length > 0 && (
            <div className="mb-8">
              <h2
                className="text-xs font-semibold uppercase tracking-wide mb-3"
                style={{ color: "var(--color-text-faint)" }}
              >
                Live Now
              </h2>
              <div className="flex flex-col gap-2">
                {liveStreams
                  .sort((a, b) => b.viewerCount - a.viewerCount)
                  .map((s) => (
                    <LiveCard key={s.login} stream={s} />
                  ))}
              </div>
            </div>
          )}

          {/* Time range toggle */}
          <div className="flex items-center gap-2 mb-6">
            {(["24h", "7d", "28d"] as Range[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setSearchParams({ range: r })}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                style={{
                  background: range === r ? "var(--color-bg-elev-2)" : undefined,
                  color: range === r ? "var(--color-text)" : "var(--color-text-faint)",
                  border: "1px solid",
                  borderColor: range === r ? "var(--color-border)" : "transparent",
                }}
              >
                {r}
              </button>
            ))}
            <span className="text-xs ml-1" style={{ color: "var(--color-text-faint)" }}>
              Last {rangeLabels[range]}
            </span>
          </div>

          {/* Total viewers chart */}
          <div
            className="rounded-lg p-5 mb-6"
            style={{
              background: "var(--color-bg-elev-1)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h2
              className="text-xs font-semibold uppercase tracking-wide mb-4"
              style={{ color: "var(--color-text-faint)" }}
            >
              Total Viewers
            </h2>
            <ViewerChart data={chartData} />
          </div>

          {/* Per-streamer breakdown */}
          <div
            className="rounded-lg overflow-hidden"
            style={{
              background: "var(--color-bg-elev-1)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div
              className="px-5 py-3 grid text-xs font-semibold uppercase tracking-wide"
              style={{
                color: "var(--color-text-faint)",
                borderBottom: "1px solid var(--color-border)",
                gridTemplateColumns: "1fr 80px 80px 80px",
              }}
            >
              <span>Streamer</span>
              <span className="text-right">Peak</span>
              <span className="text-right">Avg</span>
              <span className="text-right">Hrs Live</span>
            </div>
            {CORE_STREAMERS.map((streamer) => {
              const stat = statsMap[streamer.login];
              const live = streams.find((s) => s.login === streamer.login);
              return (
                <div
                  key={streamer.login}
                  className="px-5 py-3 grid items-center"
                  style={{
                    gridTemplateColumns: "1fr 80px 80px 80px",
                    borderBottom: "1px solid var(--color-border)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    {live?.isLive && (
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: "var(--color-success)" }}
                      />
                    )}
                    <a
                      href={`https://www.twitch.tv/${streamer.login}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium no-underline hover:underline"
                      style={{ color: "var(--color-text)" }}
                    >
                      {streamer.display}
                    </a>
                    {live?.isLive && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{
                          background: "rgba(61,214,140,0.12)",
                          color: "var(--color-success)",
                        }}
                      >
                        {formatViewers(live.viewerCount)}
                      </span>
                    )}
                  </div>
                  <span
                    className="text-sm text-right tabular-nums"
                    style={{ color: "var(--color-text-dim)" }}
                  >
                    {stat?.peak_viewers ? formatViewers(stat.peak_viewers) : "—"}
                  </span>
                  <span
                    className="text-sm text-right tabular-nums"
                    style={{ color: "var(--color-text-dim)" }}
                  >
                    {stat?.avg_viewers ? formatViewers(stat.avg_viewers) : "—"}
                  </span>
                  <span
                    className="text-sm text-right tabular-nums"
                    style={{ color: "var(--color-text-dim)" }}
                  >
                    {stat?.hours_live ? `${stat.hours_live}h` : "—"}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-xs mt-4" style={{ color: "var(--color-text-faint)" }}>
            Data sampled every ~5 minutes. Powered by the{" "}
            <a
              href="https://dev.twitch.tv/docs/api/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Twitch API
            </a>
            .
          </p>
        </div>
      </AppShell>
      <Footer />
    </div>
  );
}

function LiveCard({ stream }: { stream: StreamStatus }) {
  return (
    <a
      href={`https://www.twitch.tv/${stream.login}`}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-lg p-3 flex items-center gap-3 no-underline hover:opacity-80 transition-opacity"
      style={{
        background: "var(--color-bg-elev-1)",
        border: "1px solid var(--color-border)",
      }}
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: "var(--color-success)" }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {stream.display}
          </span>
          {stream.gameName && (
            <span className="text-xs" style={{ color: "var(--color-text-faint)" }}>
              · {stream.gameName}
            </span>
          )}
        </div>
        {stream.streamTitle && (
          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--color-text-faint)" }}>
            {stream.streamTitle}
          </p>
        )}
      </div>
      <span
        className="text-sm font-semibold flex-shrink-0 tabular-nums"
        style={{ color: "var(--color-text-dim)" }}
      >
        {formatViewers(stream.viewerCount)}
      </span>
    </a>
  );
}

function ViewerChart({ data }: { data: ChartPoint[] }) {
  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center h-24 text-sm"
        style={{ color: "var(--color-text-faint)" }}
      >
        No data yet — check back after the first stream.
      </div>
    );
  }

  const W = 600;
  const H = 100;
  const pad = 4;
  const maxV = Math.max(...data.map((d) => d.total_viewers), 1);
  const n = data.length;

  const points = data
    .map((d, i) => {
      const x = pad + (i / (n - 1)) * (W - 2 * pad);
      const y = pad + (1 - d.total_viewers / maxV) * (H - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  // Filled area
  const areaPoints = [
    `${pad},${H - pad}`,
    ...data.map((d, i) => {
      const x = pad + (i / (n - 1)) * (W - 2 * pad);
      const y = pad + (1 - d.total_viewers / maxV) * (H - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }),
    `${W - pad},${H - pad}`,
  ].join(" ");

  const peakK = formatViewers(maxV);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs" style={{ color: "var(--color-text-faint)" }}>
          Peak: {peakK}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: "80px", display: "block" }}
        aria-hidden="true"
      >
        <polygon points={areaPoints} fill="rgba(245,245,247,0.04)" />
        <polyline
          points={points}
          fill="none"
          stroke="var(--color-text-dim)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
