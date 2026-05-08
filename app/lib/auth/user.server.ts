import { redirect } from "@remix-run/cloudflare";
import { eq } from "drizzle-orm";
import { createDb } from "~/lib/db/index";
import { users } from "../../../db/schema";
import { getSession, getSessionToken } from "./session";

export interface SessionUser {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  emailVerifiedAt: Date | null;
  isPlatformAdmin: boolean;
  isVerifiedStreamer: boolean;
}

export async function getCurrentUser(request: Request, env: Env): Promise<SessionUser | null> {
  const token = getSessionToken(request);
  if (!token) return null;

  const session = await getSession(env.KV, token);
  if (!session) return null;

  const db = createDb(env.DB);
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: {
      id: true,
      handle: true,
      displayName: true,
      avatarUrl: true,
      emailVerifiedAt: true,
      isPlatformAdmin: true,
      isVerifiedStreamer: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt) return null;
  return user;
}

export function requireUser(user: SessionUser | null): SessionUser {
  if (!user) throw redirect("/auth/login");
  return user;
}

export function requireVerifiedUser(user: SessionUser | null): SessionUser {
  const u = requireUser(user);
  if (!u.emailVerifiedAt) throw new Response("Email not verified", { status: 403 });
  return u;
}
