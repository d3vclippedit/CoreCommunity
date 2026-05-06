import { generateToken } from "~/lib/utils";

export interface Session {
  userId: string;
  createdAt: number;
  expiresAt: number;
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const COOKIE_NAME = "core_session";

function sessionKey(token: string): string {
  return `session:${token}`;
}

export async function createSession(kv: KVNamespace, userId: string): Promise<string> {
  const token = generateToken();
  const now = Math.floor(Date.now() / 1000);
  const session: Session = {
    userId,
    createdAt: now,
    expiresAt: now + SESSION_TTL_SECONDS,
  };
  await kv.put(sessionKey(token), JSON.stringify(session), {
    expirationTtl: SESSION_TTL_SECONDS,
  });
  return token;
}

export async function getSession(kv: KVNamespace, token: string): Promise<Session | null> {
  const raw = await kv.get(sessionKey(token));
  if (!raw) return null;
  const session = JSON.parse(raw) as Session;
  if (session.expiresAt < Math.floor(Date.now() / 1000)) {
    await kv.delete(sessionKey(token));
    return null;
  }
  return session;
}

export async function deleteSession(kv: KVNamespace, token: string): Promise<void> {
  await kv.delete(sessionKey(token));
}

export function makeSessionCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`;
}

export function getSessionToken(request: Request): string | null {
  const cookie = request.headers.get("Cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}
