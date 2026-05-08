import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { useFetcher, useLoaderData, useRouteLoaderData } from "@remix-run/react";
import { and, desc, eq } from "drizzle-orm";
import { useState } from "react";
import { Alert } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { getCurrentUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import type { loader as rootLoader } from "~/root";
import { communityMemberships, giveawayEntries, giveaways, users } from "../../db/schema";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data ? `Giveaways — c/${data.slug}` : "Giveaways" },
];

function isMod(role: string | undefined | null) {
  return role === "mod" || role === "senior_mod" || role === "admin" || role === "streamer";
}

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const db = createDb(env.DB);
  const user = await getCurrentUser(request, env);

  const slug = params.slug ?? "";
  const communityData = await db.query.communities.findFirst({
    where: (c, { eq: eqFn, and: andFn, isNull }) => andFn(eqFn(c.slug, slug), isNull(c.deletedAt)),
    columns: { id: true, slug: true },
  });
  if (!communityData) throw new Response("Not found", { status: 404 });

  const rows = await db
    .select({
      id: giveaways.id,
      title: giveaways.title,
      prize: giveaways.prize,
      description: giveaways.description,
      status: giveaways.status,
      endsAt: giveaways.endsAt,
      minMembershipDays: giveaways.minMembershipDays,
      minPostCount: giveaways.minPostCount,
      winnerUserId: giveaways.winnerUserId,
      winnerDrawnAt: giveaways.winnerDrawnAt,
      createdAt: giveaways.createdAt,
      creatorHandle: users.handle,
    })
    .from(giveaways)
    .innerJoin(users, eq(giveaways.creatorId, users.id))
    .where(eq(giveaways.communityId, communityData.id))
    .orderBy(desc(giveaways.createdAt))
    .limit(50);

  let memberRole: string | null = null;
  let enteredIds: string[] = [];
  if (user) {
    const mem = await db.query.communityMemberships.findFirst({
      where: and(
        eq(communityMemberships.userId, user.id),
        eq(communityMemberships.communityId, communityData.id),
      ),
      columns: { role: true },
    });
    memberRole = mem?.role ?? null;

    const entries = await db.query.giveawayEntries.findMany({
      where: and(
        eq(giveawayEntries.userId, user.id),
        // only check active giveaways from this community
      ),
      columns: { giveawayId: true },
    });
    enteredIds = entries.map((e) => e.giveawayId);
  }

  return { slug, communityId: communityData.id, rows, memberRole, enteredIds };
}

export default function GiveawaysPage() {
  const { slug, communityId, rows, memberRole, enteredIds } = useLoaderData<typeof loader>();
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const rootUser = root?.user ?? null;
  const modRights = isMod(memberRole);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="py-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>
          Giveaways
        </h1>
        {modRights && (
          <Button type="button" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Cancel" : "+ Create giveaway"}
          </Button>
        )}
      </div>

      {showCreate && modRights && (
        <CreateGiveawayForm
          communityId={communityId}
          slug={slug}
          onClose={() => setShowCreate(false)}
        />
      )}

      {rows.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-text-faint)" }}>
          No giveaways yet.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((g) => (
            <GiveawayCard
              key={g.id}
              giveaway={g}
              slug={slug}
              isMod={modRights}
              hasEntered={enteredIds.includes(g.id)}
              isLoggedIn={!!rootUser}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GiveawayCard({
  giveaway,
  slug,
  isMod: modRights,
  hasEntered,
  isLoggedIn,
}: {
  giveaway: {
    id: string;
    title: string;
    prize: string;
    description: string | null;
    status: string;
    endsAt: Date | string | null;
    minMembershipDays: number | null;
    minPostCount: number | null;
    winnerUserId: string | null;
    createdAt: Date | string;
    creatorHandle: string;
  };
  slug: string;
  isMod: boolean;
  hasEntered: boolean;
  isLoggedIn: boolean;
}) {
  const fetcher = useFetcher<{ ok?: boolean; error?: string; winnerId?: string }>();
  const isActive = giveaway.status === "active";
  const isEnded = giveaway.status === "ended";

  const statusColor = isActive
    ? "var(--color-success)"
    : isEnded
      ? "var(--color-text-faint)"
      : "var(--color-danger)";

  const requirements = [];
  if (giveaway.minMembershipDays)
    requirements.push(`Member for ${giveaway.minMembershipDays}+ day(s)`);
  if (giveaway.minPostCount) requirements.push(`${giveaway.minPostCount}+ post(s) in community`);

  const showError = fetcher.data && "error" in fetcher.data ? fetcher.data.error : null;
  const enteredNow = fetcher.data?.ok && !fetcher.data.winnerId;
  const drawnNow = fetcher.data?.winnerId;

  return (
    <div
      className="rounded-lg p-5"
      style={{ background: "var(--color-bg-elev-1)", border: "1px solid var(--color-border)" }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            {giveaway.title}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-faint)" }}>
            Prize: <span style={{ color: "var(--color-text-dim)" }}>{giveaway.prize}</span>
          </p>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ border: `1px solid ${statusColor}40`, color: statusColor }}
        >
          {isActive ? "Active" : isEnded ? "Ended" : "Cancelled"}
        </span>
      </div>

      {giveaway.description && (
        <p className="text-xs mb-3" style={{ color: "var(--color-text-dim)" }}>
          {giveaway.description}
        </p>
      )}

      {requirements.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {requirements.map((r) => (
            <span
              key={r}
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: "var(--color-bg-elev-2)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-faint)",
              }}
            >
              {r}
            </span>
          ))}
        </div>
      )}

      {giveaway.endsAt && (
        <p className="text-xs mb-3" style={{ color: "var(--color-text-faint)" }}>
          Ends: {new Date(giveaway.endsAt).toLocaleDateString()}
        </p>
      )}

      {showError && (
        <Alert variant="error" className="mb-2">
          {showError}
        </Alert>
      )}

      {isEnded && giveaway.winnerUserId && (
        <p className="text-xs" style={{ color: "var(--color-success)" }}>
          Winner drawn!
        </p>
      )}
      {drawnNow && (
        <p className="text-xs" style={{ color: "var(--color-success)" }}>
          Winner drawn!
        </p>
      )}

      <div className="flex gap-2 mt-3">
        {isActive && isLoggedIn && !hasEntered && !enteredNow && (
          <fetcher.Form method="post" action="/api/giveaway">
            <input type="hidden" name="intent" value="enter" />
            <input type="hidden" name="giveawayId" value={giveaway.id} />
            <button
              type="submit"
              disabled={fetcher.state !== "idle"}
              className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
              style={{
                background: "var(--color-text)",
                color: "var(--color-bg)",
                border: "none",
                cursor: "pointer",
              }}
            >
              {fetcher.state !== "idle" ? "Entering…" : "Enter giveaway"}
            </button>
          </fetcher.Form>
        )}
        {(hasEntered || enteredNow) && isActive && (
          <span
            className="text-xs px-3 py-1.5 rounded-md"
            style={{ color: "var(--color-success)", background: "var(--color-bg-elev-2)" }}
          >
            Entered ✓
          </span>
        )}
        {modRights && isActive && !drawnNow && (
          <fetcher.Form method="post" action="/api/giveaway">
            <input type="hidden" name="intent" value="draw" />
            <input type="hidden" name="giveawayId" value={giveaway.id} />
            <button
              type="submit"
              disabled={fetcher.state !== "idle"}
              className="px-3 py-1.5 text-xs font-medium rounded-md"
              style={{
                background: "var(--color-bg-elev-2)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-dim)",
                cursor: "pointer",
              }}
            >
              Draw winner
            </button>
          </fetcher.Form>
        )}
        {modRights && isActive && (
          <fetcher.Form method="post" action="/api/giveaway">
            <input type="hidden" name="intent" value="cancel" />
            <input type="hidden" name="giveawayId" value={giveaway.id} />
            <button
              type="submit"
              disabled={fetcher.state !== "idle"}
              className="px-3 py-1.5 text-xs rounded-md"
              style={{
                background: "none",
                border: "none",
                color: "var(--color-danger)",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </fetcher.Form>
        )}
      </div>
    </div>
  );
}

function CreateGiveawayForm({
  communityId,
  slug,
  onClose,
}: {
  communityId: string;
  slug: string;
  onClose: () => void;
}) {
  const fetcher = useFetcher<{ error?: string }>();

  return (
    <div
      className="rounded-lg p-5"
      style={{ background: "var(--color-bg-elev-1)", border: "1px solid var(--color-border)" }}
    >
      <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text)" }}>
        Create giveaway
      </h2>
      {fetcher.data?.error && (
        <Alert variant="error" className="mb-3">
          {fetcher.data.error}
        </Alert>
      )}
      <fetcher.Form method="post" action="/api/giveaway" className="flex flex-col gap-3">
        <input type="hidden" name="intent" value="create" />
        <input type="hidden" name="communityId" value={communityId} />
        <input type="hidden" name="slug" value={slug} />
        <Input
          id="gTitle"
          name="title"
          type="text"
          label="Title"
          placeholder="Summer Giveaway"
          required
        />
        <Input
          id="gPrize"
          name="prize"
          type="text"
          label="Prize"
          placeholder="$25 gift card"
          required
        />
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="gDesc"
            className="text-sm font-medium"
            style={{ color: "var(--color-text)" }}
          >
            Description <span style={{ color: "var(--color-text-faint)" }}>(optional)</span>
          </label>
          <textarea
            id="gDesc"
            name="description"
            rows={2}
            placeholder="Tell members what this is about…"
            className="w-full rounded-md px-3 py-2 text-sm resize-none"
            style={{
              background: "var(--color-bg-elev-2)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
              outline: "none",
            }}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input id="gEndsAt" name="endsAt" type="datetime-local" label="End date (optional)" />
          <Input
            id="gMinDays"
            name="minMembershipDays"
            type="number"
            label="Min. membership days"
            placeholder="0 = none"
            min="0"
          />
        </div>
        <Input
          id="gMinPosts"
          name="minPostCount"
          type="number"
          label="Min. post count"
          placeholder="0 = none"
          min="0"
        />
        <div className="flex gap-3">
          <Button type="submit" loading={fetcher.state !== "idle"}>
            Create
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md"
            style={{
              color: "var(--color-text-dim)",
              border: "1px solid var(--color-border)",
              background: "none",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </fetcher.Form>
    </div>
  );
}
