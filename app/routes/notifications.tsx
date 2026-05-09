import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import { and, desc, eq, isNull } from "drizzle-orm";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { communities, notifications, posts, users } from "../../db/schema";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) throw redirect("/auth/login");

  const db = createDb(env.DB);

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
    .limit(50);

  // Auto-mark all as read when the page is viewed
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));

  return { user, notifications: rows };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const user = await getCurrentUser(request, env);
  if (!user) return Response.json({ error: "Not signed in." }, { status: 401 });

  const db = createDb(env.DB);
  const now = new Date();

  await db
    .update(notifications)
    .set({ readAt: now })
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));

  return Response.json({ success: true });
}

function relativeTime(dateStr: string | Date): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function notifMessage(n: {
  type: string;
  actorDisplayName: string | null;
  communityName: string | null;
  postTitle: string | null;
}) {
  if (n.type === "community_post") {
    return (
      <>
        <span className="font-medium" style={{ color: "var(--color-text)" }}>
          {n.communityName ?? "A community"}
        </span>{" "}
        posted a new post
        {n.postTitle ? (
          <>
            {" — "}
            <span className="font-medium" style={{ color: "var(--color-text)" }}>
              {n.postTitle}
            </span>
          </>
        ) : null}
      </>
    );
  }
  if (n.type === "mention") {
    return (
      <>
        <span className="font-medium" style={{ color: "var(--color-text)" }}>
          {n.actorDisplayName ?? "Someone"}
        </span>{" "}
        mentioned you
      </>
    );
  }
  if (n.type === "badge_received") {
    return (
      <>
        <span className="font-medium" style={{ color: "var(--color-text)" }}>
          {n.actorDisplayName ?? "Someone"}
        </span>{" "}
        gave your post a badge
      </>
    );
  }
  if (n.type === "post_comment") {
    return (
      <>
        <span className="font-medium" style={{ color: "var(--color-text)" }}>
          {n.actorDisplayName ?? "Someone"}
        </span>{" "}
        commented on your post
        {n.postTitle ? (
          <>
            {" — "}
            <span className="font-medium" style={{ color: "var(--color-text)" }}>
              {n.postTitle}
            </span>
          </>
        ) : null}
      </>
    );
  }
  if (n.type === "post_upvote") {
    return (
      <>
        <span className="font-medium" style={{ color: "var(--color-text)" }}>
          {n.actorDisplayName ?? "Someone"}
        </span>{" "}
        upvoted your post
        {n.postTitle ? (
          <>
            {" — "}
            <span className="font-medium" style={{ color: "var(--color-text)" }}>
              {n.postTitle}
            </span>
          </>
        ) : null}
      </>
    );
  }
  if (n.type === "comment_reply") {
    return (
      <>
        <span className="font-medium" style={{ color: "var(--color-text)" }}>
          {n.actorDisplayName ?? "Someone"}
        </span>{" "}
        replied to your comment
        {n.postTitle ? (
          <>
            {" on "}
            <span className="font-medium" style={{ color: "var(--color-text)" }}>
              {n.postTitle}
            </span>
          </>
        ) : null}
      </>
    );
  }
  if (n.type === "comment_like") {
    return (
      <>
        <span className="font-medium" style={{ color: "var(--color-text)" }}>
          {n.actorDisplayName ?? "Someone"}
        </span>{" "}
        liked your comment
        {n.postTitle ? (
          <>
            {" on "}
            <span className="font-medium" style={{ color: "var(--color-text)" }}>
              {n.postTitle}
            </span>
          </>
        ) : null}
      </>
    );
  }
  return "New notification";
}

export default function NotificationsPage() {
  const { user, notifications: notifs } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const unread = notifs.filter((n) => !n.readAt);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header user={user} />
      <AppShell>
        <div className="py-6 max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>
              Notifications
            </h1>
            {unread.length > 0 && (
              <fetcher.Form method="post">
                <button
                  type="submit"
                  className="text-xs tab-btn px-3 py-1 rounded-md transition-colors"
                  style={{ color: "var(--color-text-faint)" }}
                >
                  Mark all read
                </button>
              </fetcher.Form>
            )}
          </div>

          {notifs.length === 0 ? (
            <div
              className="rounded-lg p-8 text-center"
              style={{
                background: "var(--color-bg-elev-1)",
                border: "1px solid var(--color-border)",
              }}
            >
              <p className="text-sm" style={{ color: "var(--color-text-dim)" }}>
                No notifications yet. Turn on notifications for a community to get started.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {notifs.map((n) => {
                const isUnread = !n.readAt;
                const href =
                  n.postId && n.communitySlug
                    ? `/c/${n.communitySlug}/p/${n.postId}`
                    : n.communitySlug
                      ? `/c/${n.communitySlug}`
                      : "/notifications";
                return (
                  <Link
                    key={n.id}
                    to={href}
                    className="flex items-start gap-3 px-4 py-3 rounded-lg no-underline transition-colors"
                    style={{
                      background: isUnread ? "var(--color-bg-elev-2)" : "var(--color-bg-elev-1)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    {isUnread && (
                      <div
                        className="flex-shrink-0 mt-1.5 rounded-full"
                        style={{
                          width: 6,
                          height: 6,
                          background: "var(--color-danger)",
                        }}
                      />
                    )}
                    <div className={isUnread ? "" : "ml-[22px]"} style={{ flex: 1 }}>
                      <p
                        className="text-sm leading-snug"
                        style={{ color: "var(--color-text-dim)" }}
                      >
                        {notifMessage(n)}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-text-faint)" }}>
                        {relativeTime(n.createdAt as unknown as string)}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </AppShell>
      <Footer />
    </div>
  );
}
