export function getTwitchAuthUrl(clientId: string, redirectUri: string, state: string): string {
  return `https://id.twitch.tv/oauth2/authorize?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "user:read:email",
    state,
    force_verify: "true",
  }).toString()}`;
}

export async function exchangeTwitchCode(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<{ access_token: string; refresh_token: string }> {
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)");
    throw new Error(`Twitch token exchange failed: ${res.status} — ${body}`);
  }
  return res.json() as Promise<{ access_token: string; refresh_token: string }>;
}

export async function getTwitchUser(
  accessToken: string,
  clientId: string,
): Promise<{ id: string; login: string; display_name: string }> {
  const res = await fetch("https://api.twitch.tv/helix/users", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Id": clientId,
    },
  });
  if (!res.ok) throw new Error(`Twitch user fetch failed: ${res.status}`);
  const data = (await res.json()) as {
    data: Array<{ id: string; login: string; display_name: string }>;
  };
  const user = data.data[0];
  if (!user) throw new Error("No Twitch user returned");
  return user;
}
