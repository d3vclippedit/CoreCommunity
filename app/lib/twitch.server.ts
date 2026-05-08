type TwitchTokenCache = { accessToken: string; expiresAt: number };

async function getAppToken(env: {
  TWITCH_CLIENT_ID: string;
  TWITCH_CLIENT_SECRET: string;
  KV: KVNamespace;
}): Promise<string> {
  const cached = await env.KV.get<TwitchTokenCache>("twitch:app_token", "json");
  if (cached && cached.expiresAt > Date.now()) return cached.accessToken;

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.TWITCH_CLIENT_ID,
      client_secret: env.TWITCH_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) throw new Error(`Twitch token fetch failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };

  const expiresAt = Date.now() + (data.expires_in - 300) * 1000;
  await env.KV.put(
    "twitch:app_token",
    JSON.stringify({ accessToken: data.access_token, expiresAt }),
    {
      expirationTtl: data.expires_in - 300,
    },
  );

  return data.access_token;
}

export async function isTwitchLive(
  channel: string,
  env: { TWITCH_CLIENT_ID: string; TWITCH_CLIENT_SECRET: string; KV: KVNamespace },
): Promise<boolean> {
  const cacheKey = `twitch:live:${channel.toLowerCase()}`;
  const cached = await env.KV.get<{ live: boolean }>(cacheKey, "json");
  if (cached !== null) return cached.live;

  try {
    const token = await getAppToken(env);
    const res = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(channel)}`,
      {
        headers: {
          "Client-ID": env.TWITCH_CLIENT_ID,
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!res.ok) return false;
    const data = (await res.json()) as { data: unknown[] };
    const live = data.data.length > 0;

    await env.KV.put(cacheKey, JSON.stringify({ live }), { expirationTtl: 60 });
    return live;
  } catch {
    return false;
  }
}
