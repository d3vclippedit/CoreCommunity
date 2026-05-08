import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { getCurrentUser } from "~/lib/auth/user.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user?.isPlatformAdmin) throw new Response("Forbidden", { status: 403 });

  const clientId = env.TWITCH_CLIENT_ID;
  const clientSecret = env.TWITCH_CLIENT_SECRET;

  const url = new URL(request.url);
  const redirectUri = `${url.protocol}//${url.host}/auth/twitch/callback`;

  const clientIdSet = !!clientId;
  const clientSecretSet = !!clientSecret;
  const clientIdPreview = clientId ? `${clientId.slice(0, 6)}…${clientId.slice(-4)}` : "NOT SET";

  // Test client credentials grant (doesn't need user — just validates client_id + secret)
  let credentialsValid = false;
  let credentialsError: string | null = null;
  if (clientId && clientSecret) {
    try {
      const res = await fetch("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "client_credentials",
        }),
      });
      const body = await res.text();
      if (res.ok) {
        credentialsValid = true;
      } else {
        credentialsError = `${res.status}: ${body}`;
      }
    } catch (e) {
      credentialsError = String(e);
    }
  }

  return json({
    clientIdSet,
    clientSecretSet,
    clientIdPreview,
    credentialsValid,
    credentialsError,
    redirectUri,
    host: url.host,
    protocol: url.protocol,
  });
}

export default function TwitchDebug() {
  const d = useLoaderData<typeof loader>();

  const row = (label: string, value: React.ReactNode, ok?: boolean) => (
    <tr key={label}>
      <td className="pr-6 py-1.5 text-sm font-medium" style={{ color: "var(--color-text-dim)" }}>
        {label}
      </td>
      <td
        className="py-1.5 text-sm font-mono"
        style={{
          color:
            ok === true
              ? "var(--color-success)"
              : ok === false
                ? "var(--color-danger)"
                : "var(--color-text)",
        }}
      >
        {value}
      </td>
    </tr>
  );

  return (
    <div
      className="min-h-screen flex items-start justify-center pt-20 px-4"
      style={{ background: "var(--color-bg)" }}
    >
      <div
        className="w-full max-w-xl rounded-lg p-6"
        style={{ background: "var(--color-bg-elev-1)", border: "1px solid var(--color-border)" }}
      >
        <h1 className="text-base font-semibold mb-4" style={{ color: "var(--color-text)" }}>
          Twitch OAuth Diagnostics
        </h1>
        <table className="w-full">
          <tbody>
            {row("TWITCH_CLIENT_ID set", d.clientIdSet ? "Yes" : "No", d.clientIdSet)}
            {row("TWITCH_CLIENT_SECRET set", d.clientSecretSet ? "Yes" : "No", d.clientSecretSet)}
            {row("Client ID preview", d.clientIdPreview)}
            {row(
              "Credentials valid",
              d.credentialsValid ? "Yes — client_credentials grant OK" : `No — ${d.credentialsError}`,
              d.credentialsValid,
            )}
            {row("Redirect URI (generated)", d.redirectUri)}
            {row("Host seen by server", d.host)}
            {row("Protocol seen by server", d.protocol)}
          </tbody>
        </table>
        <p className="text-xs mt-4" style={{ color: "var(--color-text-faint)" }}>
          The redirect URI above must be registered exactly in your{" "}
          <a
            href="https://dev.twitch.tv/console/apps"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            style={{ color: "var(--color-text-dim)" }}
          >
            Twitch Developer Console
          </a>
          .
        </p>
        <p className="text-xs mt-2" style={{ color: "var(--color-text-faint)" }}>
          Delete this route once debugging is complete.
        </p>
      </div>
    </div>
  );
}
