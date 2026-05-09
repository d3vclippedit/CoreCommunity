import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/cloudflare";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
} from "@remix-run/react";
import { desc } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "~/lib/auth/user.server";
import { getBalance } from "~/lib/coins.server";
import { createDb } from "~/lib/db/index";
import tailwindStyles from "~/styles/tailwind.css?url";
import { communities, notifications, posts, users } from "../db/schema";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous" as const,
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:wght@400;500&display=swap",
  },
  { rel: "preconnect", href: "https://www.youtube.com" },
  { rel: "preconnect", href: "https://i.ytimg.com", crossOrigin: "anonymous" as const },
  { rel: "dns-prefetch", href: "https://player.twitch.tv" },
  { rel: "dns-prefetch", href: "https://clips.twitch.tv" },
  { rel: "dns-prefetch", href: "https://static-cdn.jtvnw.net" },
  { rel: "stylesheet", href: tailwindStyles },
  { rel: "icon", href: "/favicon.ico" },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  const db = createDb(env.DB);
  let coinBalance = 0;
  let unreadNotifCount = 0;
  let recentNotifs: {
    id: string;
    type: string;
    readAt: Date | null;
    createdAt: Date;
    actorHandle: string | null;
    actorDisplayName: string | null;
    communitySlug: string | null;
    communityName: string | null;
    postId: string | null;
    postTitle: string | null;
  }[] = [];
  if (user) {
    try {
      coinBalance = await getBalance(db, user.id);
    } catch {
      // coins table not yet migrated
    }
    try {
      const rows = await db
        .select({
          id: notifications.id,
          type: notifications.type,
          readAt: notifications.readAt,
          createdAt: notifications.createdAt,
          actorHandle: users.handle,
          actorDisplayName: users.displayName,
          communitySlug: communities.slug,
          communityName: communities.name,
          postId: notifications.postId,
          postTitle: posts.title,
        })
        .from(notifications)
        .leftJoin(users, eq(notifications.actorId, users.id))
        .leftJoin(communities, eq(notifications.communityId, communities.id))
        .leftJoin(posts, eq(notifications.postId, posts.id))
        .where(eq(notifications.userId, user.id))
        .orderBy(desc(notifications.createdAt))
        .limit(7);
      unreadNotifCount = rows.filter((r) => !r.readAt).length;
      recentNotifs = rows;
    } catch {
      // notifications table not yet migrated
    }
  }
  return { user, coinBalance, unreadNotifCount, recentNotifs };
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0A0A0C" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary() {
  const error = useRouteError();

  let status = 500;
  let message = "Something went wrong.";

  if (isRouteErrorResponse(error)) {
    status = error.status;
    message = error.statusText || message;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p
          className="text-6xl font-bold font-display mb-4"
          style={{ color: "var(--color-text-faint)" }}
        >
          {status}
        </p>
        <h1 className="text-xl font-semibold mb-2" style={{ color: "var(--color-text)" }}>
          {status === 404 ? "Page not found" : "Something went wrong"}
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--color-text-dim)" }}>
          {message}
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors"
          style={{
            background: "var(--color-bg-elev-2)",
            color: "var(--color-text)",
            border: "1px solid var(--color-border)",
          }}
        >
          Go home
        </a>
      </div>
    </div>
  );
}
