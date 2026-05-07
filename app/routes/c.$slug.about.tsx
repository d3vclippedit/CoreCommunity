import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { and, eq, isNull } from "drizzle-orm";
import { createDb } from "~/lib/db/index";
import { communities } from "../../db/schema";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data ? `About c/${data.slug} — CORE` : "Cormunities" },
];

export async function loader({ params, context }: LoaderFunctionArgs) {
  const db = createDb(context.cloudflare.env.DB);
  const community = await db.query.communities.findFirst({
    where: and(eq(communities.slug, params.slug ?? ""), isNull(communities.deletedAt)),
    columns: {
      slug: true,
      name: true,
      description: true,
      rules: true,
      memberCount: true,
      createdAt: true,
    },
  });
  if (!community) throw new Response("Community not found", { status: 404 });
  return community;
}

export default function CommunityAbout() {
  const community = useLoaderData<typeof loader>();

  const rules: string[] = (() => {
    try {
      return community.rules ? JSON.parse(community.rules) : [];
    } catch {
      return [];
    }
  })();

  return (
    <div className="flex flex-col gap-4 py-4">
      <section
        className="rounded-lg p-5"
        style={{ background: "var(--color-bg-elev-1)", border: "1px solid var(--color-border)" }}
      >
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text)" }}>
          About c/{community.slug}
        </h2>
        {community.description ? (
          <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-dim)" }}>
            {community.description}
          </p>
        ) : (
          <p className="text-sm" style={{ color: "var(--color-text-faint)" }}>
            No description yet.
          </p>
        )}

        <div
          className="mt-4 pt-4 grid grid-cols-2 gap-3 border-t"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div>
            <p className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>
              {community.memberCount.toLocaleString()}
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
              Members
            </p>
          </div>
        </div>

        <p className="text-xs mt-3" style={{ color: "var(--color-text-faint)" }}>
          Created{" "}
          {new Date(community.createdAt).toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </p>
      </section>

      {rules.length > 0 && (
        <section
          className="rounded-lg p-5"
          style={{ background: "var(--color-bg-elev-1)", border: "1px solid var(--color-border)" }}
        >
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text)" }}>
            Community rules
          </h2>
          <ol className="flex flex-col gap-2">
            {rules.map((rule, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: rules list is stable display-only
              <li key={i} className="flex gap-2.5 text-sm">
                <span
                  className="flex-shrink-0 font-semibold w-5 text-right"
                  style={{ color: "var(--color-text-faint)" }}
                >
                  {i + 1}.
                </span>
                <span style={{ color: "var(--color-text-dim)" }}>{rule}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
