import { CORE_STREAMERS, type StreamStatus } from "./shared";

export { CORE_STREAMERS, type StreamStatus } from "./shared";

interface TwitchStream {
  user_login: string;
  title: string;
  viewer_count: number;
  game_name: string;
  thumbnail_url: string;
  started_at: string;
}

const OFFLINE_STATUSES: StreamStatus[] = CORE_STREAMERS.map((s) => ({
  login: s.login,
  display: s.display,
  isLive: false,
  viewerCount: 0,
  streamTitle: null,
  gameName: null,
  thumbnailUrl: null,
  startedAt: null,
}));

async function getAppToken(
  clientId: string,
  clientSecret: string,
  kv: KVNamespace,
): Promise<string> {
  const cached = await kv.get("twitch:token");
  if (cached) return cached;

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) throw new Error(`Twitch token request failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  await kv.put("twitch:token", data.access_token, {
    expirationTtl: Math.max(data.expires_in - 600, 3600),
  });
  return data.access_token;
}

export async function getLiveStreams(
  kv: KVNamespace,
  db: D1Database,
  clientId: string | undefined,
  clientSecret: string | undefined,
): Promise<StreamStatus[]> {
  if (!clientId || !clientSecret) return OFFLINE_STATUSES;

  try {
    const cached = await kv.get("twitch:streams", "json");
    if (cached) return cached as StreamStatus[];

    const token = await getAppToken(clientId, clientSecret, kv);
    const query = CORE_STREAMERS.map((s) => `user_login=${s.login}`).join("&");
    const res = await fetch(`https://api.twitch.tv/helix/streams?${query}&first=20`, {
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return OFFLINE_STATUSES;

    const data = (await res.json()) as { data: TwitchStream[] };
    const liveMap = new Map(data.data.map((s) => [s.user_login.toLowerCase(), s]));

    const statuses: StreamStatus[] = CORE_STREAMERS.map((s) => {
      const live = liveMap.get(s.login);
      return {
        login: s.login,
        display: s.display,
        isLive: !!live,
        viewerCount: live?.viewer_count ?? 0,
        streamTitle: live?.title ?? null,
        gameName: live?.game_name ?? null,
        thumbnailUrl: live
          ? live.thumbnail_url.replace("{width}", "320").replace("{height}", "180")
          : null,
        startedAt: live?.started_at ?? null,
      };
    });

    await kv.put("twitch:streams", JSON.stringify(statuses), { expirationTtl: 60 });

    // Snapshot to D1 every 5 minutes (fire-and-forget)
    void saveSnapshot(db, kv, statuses);

    return statuses;
  } catch {
    return OFFLINE_STATUSES;
  }
}

async function saveSnapshot(
  db: D1Database,
  kv: KVNamespace,
  statuses: StreamStatus[],
): Promise<void> {
  const lockKey = "twitch:snap_lock";
  const locked = await kv.get(lockKey);
  if (locked) return;

  await kv.put(lockKey, "1", { expirationTtl: 300 });

  const now = Math.floor(Date.now() / 1000);
  const stmts = statuses.map((s) =>
    db
      .prepare(
        `INSERT INTO stream_snapshots (id, streamer_login, viewer_count, is_live, stream_title, game_name, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID().replace(/-/g, "").slice(0, 20),
        s.login,
        s.viewerCount,
        s.isLive ? 1 : 0,
        s.streamTitle,
        s.gameName,
        now,
      ),
  );

  await db.batch(stmts);
}
