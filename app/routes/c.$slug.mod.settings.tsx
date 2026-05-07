import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  useRouteLoaderData,
} from "@remix-run/react";
import { and, eq, isNull, ne } from "drizzle-orm";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
import { Header } from "~/components/layout/Header";
import { Alert } from "~/components/ui/Alert";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { getCurrentUser, requireUser } from "~/lib/auth/user.server";
import { createDb } from "~/lib/db/index";
import { canManageRules, canManageStaff } from "~/lib/permissions";
import { generateId } from "~/lib/utils";
import type { loader as rootLoader } from "~/root";
import {
  type CommunityRole,
  communities,
  communityMemberships,
  moderationActions,
  users,
} from "../../db/schema";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data ? `Settings — c/${data.community.slug}` : "CORE" },
];

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const { env } = context.cloudflare;
  const user = requireUser(await getCurrentUser(request, env));
  const db = createDb(env.DB);

  const community = await db.query.communities.findFirst({
    where: and(eq(communities.slug, params.slug ?? ""), isNull(communities.deletedAt)),
  });
  if (!community) throw new Response("Community not found", { status: 404 });

  const membership = await db.query.communityMemberships.findFirst({
    where: and(
      eq(communityMemberships.userId, user.id),
      eq(communityMemberships.communityId, community.id),
    ),
    columns: { role: true },
  });

  if (!canManageRules(membership?.role) && !user.isPlatformAdmin) {
    throw new Response("Forbidden", { status: 403 });
  }

  const staff = await db
    .select({
      userId: communityMemberships.userId,
      role: communityMemberships.role,
      handle: users.handle,
      displayName: users.displayName,
    })
    .from(communityMemberships)
    .innerJoin(users, eq(communityMemberships.userId, users.id))
    .where(
      and(
        eq(communityMemberships.communityId, community.id),
        ne(communityMemberships.role, "member"),
      ),
    );

  return { community, staff, myRole: membership?.role ?? null };
}

export async function action({ params, request, context }: ActionFunctionArgs) {
  const { env } = context.cloudflare;
  const user = requireUser(await getCurrentUser(request, env));
  const db = createDb(env.DB);

  const community = await db.query.communities.findFirst({
    where: and(eq(communities.slug, params.slug ?? ""), isNull(communities.deletedAt)),
    columns: { id: true, slug: true },
  });
  if (!community) throw new Response("Community not found", { status: 404 });

  const membership = await db.query.communityMemberships.findFirst({
    where: and(
      eq(communityMemberships.userId, user.id),
      eq(communityMemberships.communityId, community.id),
    ),
    columns: { role: true },
  });

  if (!canManageRules(membership?.role) && !user.isPlatformAdmin) {
    throw new Response("Forbidden", { status: 403 });
  }

  const form = await request.formData();
  const intent = (form.get("_intent") as string | null) ?? "settings";

  // ── Community settings ────────────────────────────────────────────────────
  if (intent === "settings") {
    const name = (form.get("name") as string | null)?.trim() ?? "";
    const tagline = (form.get("tagline") as string | null)?.trim() ?? "";
    const description = (form.get("description") as string | null)?.trim() ?? "";
    const rules = (form.get("rules") as string | null)?.trim() ?? "";
    const accentColor = (form.get("accentColor") as string | null)?.trim() ?? "";

    if (!name || name.length < 2 || name.length > 64)
      return { error: "Name must be between 2 and 64 characters.", intent };
    if (tagline.length > 120) return { error: "Tagline must be under 120 characters.", intent };
    if (accentColor && !/^#[0-9a-fA-F]{6}$/.test(accentColor))
      return { error: "Accent color must be a valid hex color like #3DD68C.", intent };

    const rulesArray = rules
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean);

    await db
      .update(communities)
      .set({
        name,
        tagline: tagline || null,
        description: description || null,
        rules: rulesArray.length ? JSON.stringify(rulesArray) : null,
        accentColor: accentColor || null,
        updatedAt: new Date(),
      })
      .where(eq(communities.id, community.id));

    await db.insert(moderationActions).values({
      id: generateId(),
      communityId: community.id,
      actorId: user.id,
      action: "settings_change",
      createdAt: new Date(),
    });

    return { ok: true, intent };
  }

  // ── Add staff ─────────────────────────────────────────────────────────────
  if (intent === "add_staff") {
    if (!canManageStaff(membership?.role) && !user.isPlatformAdmin)
      return { error: "You don't have permission to manage staff.", intent };

    const handle = (form.get("staffHandle") as string | null)?.trim().toLowerCase() ?? "";
    const role = (form.get("staffRole") as string | null) ?? "mod";

    const validRoles: CommunityRole[] = ["mod", "senior_mod", "admin"];
    if (!validRoles.includes(role as CommunityRole)) return { error: "Invalid role.", intent };

    const targetUser = await db.query.users.findFirst({
      where: eq(users.handle, handle),
      columns: { id: true },
    });
    if (!targetUser) return { error: `No user found with handle @${handle}.`, intent };

    const now = new Date();
    const existing = await db.query.communityMemberships.findFirst({
      where: and(
        eq(communityMemberships.userId, targetUser.id),
        eq(communityMemberships.communityId, community.id),
      ),
    });

    if (existing) {
      await db
        .update(communityMemberships)
        .set({ role: role as CommunityRole, updatedAt: now })
        .where(
          and(
            eq(communityMemberships.userId, targetUser.id),
            eq(communityMemberships.communityId, community.id),
          ),
        );
    } else {
      await db.insert(communityMemberships).values({
        userId: targetUser.id,
        communityId: community.id,
        role: role as CommunityRole,
        joinedAt: now,
        updatedAt: now,
      });
    }

    await db.insert(moderationActions).values({
      id: generateId(),
      communityId: community.id,
      actorId: user.id,
      action: "role_change",
      targetType: "user",
      targetId: targetUser.id,
      metadata: JSON.stringify({ role, handle }),
      createdAt: now,
    });

    return { ok: true, intent };
  }

  // ── Remove staff ──────────────────────────────────────────────────────────
  if (intent === "remove_staff") {
    if (!canManageStaff(membership?.role) && !user.isPlatformAdmin)
      return { error: "You don't have permission to manage staff.", intent };

    const targetUserId = (form.get("staffUserId") as string | null) ?? "";
    if (!targetUserId) return { error: "Missing user.", intent };

    const now = new Date();
    await db
      .update(communityMemberships)
      .set({ role: "member", updatedAt: now })
      .where(
        and(
          eq(communityMemberships.userId, targetUserId),
          eq(communityMemberships.communityId, community.id),
        ),
      );

    await db.insert(moderationActions).values({
      id: generateId(),
      communityId: community.id,
      actorId: user.id,
      action: "role_change",
      targetType: "user",
      targetId: targetUserId,
      metadata: JSON.stringify({ role: "member" }),
      createdAt: now,
    });

    return { ok: true, intent };
  }

  return { error: "Unknown action.", intent: "" };
}

export default function ModSettings() {
  const { community, staff, myRole } = useLoaderData<typeof loader>();
  const data = useActionData<typeof action>();
  const nav = useNavigation();
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const user = root?.user ?? null;

  const isSubmitting = nav.state === "submitting";
  const canStaff =
    canManageStaff(myRole as Parameters<typeof canManageStaff>[0]) || user?.isPlatformAdmin;

  const existingRules: string[] = (() => {
    try {
      return community.rules ? JSON.parse(community.rules) : [];
    } catch {
      return [];
    }
  })();

  const settingsOk = data && "ok" in data && data.ok && data.intent === "settings";
  const staffOk = data && "ok" in data && data.ok && data.intent !== "settings";
  const errorMsg = data && "error" in data ? data.error : null;

  const ROLE_LABELS: Record<string, string> = {
    streamer: "Streamer",
    admin: "Admin",
    senior_mod: "Senior Mod",
    mod: "Mod",
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
      <Header user={user} />
      <AppShell>
        <div className="py-6 max-w-xl flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <Link
              to={`/c/${community.slug}`}
              className="text-sm no-underline hover:underline"
              style={{ color: "var(--color-text-dim)" }}
            >
              ← c/{community.slug}
            </Link>
            <h1 className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>
              Community settings
            </h1>
          </div>

          {settingsOk && <Alert variant="success">Settings saved.</Alert>}
          {staffOk && <Alert variant="success">Staff updated.</Alert>}
          {errorMsg && <Alert variant="error">{errorMsg}</Alert>}

          {/* ── General settings ── */}
          <div
            className="rounded-lg p-6"
            style={{
              background: "var(--color-bg-elev-1)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text)" }}>
              General
            </h2>
            <Form method="post" className="flex flex-col gap-4">
              <input type="hidden" name="_intent" value="settings" />
              <Input
                id="name"
                name="name"
                type="text"
                label="Display name"
                defaultValue={community.name}
                required
              />
              <Input
                id="tagline"
                name="tagline"
                type="text"
                label="Tagline"
                placeholder="Short community description (shown in directory)"
                defaultValue={community.tagline ?? ""}
                hint="Max 120 characters."
              />
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="description"
                  className="text-sm font-medium"
                  style={{ color: "var(--color-text)" }}
                >
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  defaultValue={community.description ?? ""}
                  rows={3}
                  className="w-full rounded-md px-3 py-2 text-sm resize-none"
                  style={{
                    background: "var(--color-bg-elev-2)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                    outline: "none",
                  }}
                />
              </div>

              {/* Accent color */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="accentColor"
                  className="text-sm font-medium"
                  style={{ color: "var(--color-text)" }}
                >
                  Accent color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    id="accentColorPicker"
                    defaultValue={community.accentColor ?? "#f5f5f7"}
                    onChange={(e) => {
                      const input = document.getElementById("accentColor") as HTMLInputElement;
                      if (input) input.value = e.target.value;
                    }}
                    className="w-10 h-9 rounded cursor-pointer"
                    style={{
                      border: "1px solid var(--color-border)",
                      padding: "2px",
                      background: "var(--color-bg-elev-2)",
                    }}
                  />
                  <input
                    type="text"
                    id="accentColor"
                    name="accentColor"
                    defaultValue={community.accentColor ?? ""}
                    placeholder="#f5f5f7"
                    pattern="#[0-9a-fA-F]{6}"
                    className="flex-1 rounded-md px-3 py-2 text-sm font-mono"
                    style={{
                      background: "var(--color-bg-elev-2)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                      outline: "none",
                    }}
                    onChange={(e) => {
                      if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                        const picker = document.getElementById(
                          "accentColorPicker",
                        ) as HTMLInputElement;
                        if (picker) picker.value = e.target.value;
                      }
                    }}
                  />
                </div>
                <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                  Used for highlights and links within this community.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="rules"
                  className="text-sm font-medium"
                  style={{ color: "var(--color-text)" }}
                >
                  Rules
                </label>
                <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                  One rule per line.
                </p>
                <textarea
                  id="rules"
                  name="rules"
                  defaultValue={existingRules.join("\n")}
                  rows={5}
                  className="w-full rounded-md px-3 py-2 text-sm resize-y font-mono"
                  style={{
                    background: "var(--color-bg-elev-2)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                    outline: "none",
                  }}
                />
              </div>
              <Button type="submit" loading={isSubmitting} className="w-full">
                Save settings
              </Button>
            </Form>
          </div>

          {/* ── Staff management ── */}
          <div
            className="rounded-lg p-6"
            style={{
              background: "var(--color-bg-elev-1)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text)" }}>
              Staff
            </h2>

            {/* Current staff list */}
            {staff.length === 0 ? (
              <p className="text-sm mb-4" style={{ color: "var(--color-text-faint)" }}>
                No staff yet.
              </p>
            ) : (
              <div
                className="flex flex-col divide-y mb-4"
                style={{ borderColor: "var(--color-border)" }}
              >
                {staff.map((s) => (
                  <div key={s.userId} className="flex items-center justify-between py-3">
                    <div>
                      <span className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                        @{s.handle}
                      </span>
                      <span
                        className="ml-2 text-xs px-1.5 py-0.5 rounded"
                        style={{
                          background: "var(--color-bg-elev-2)",
                          color: "var(--color-text-dim)",
                          border: "1px solid var(--color-border)",
                        }}
                      >
                        {ROLE_LABELS[s.role] ?? s.role}
                      </span>
                    </div>
                    {canStaff && s.role !== "streamer" && (
                      <Form method="post">
                        <input type="hidden" name="_intent" value="remove_staff" />
                        <input type="hidden" name="staffUserId" value={s.userId} />
                        <button
                          type="submit"
                          className="text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
                          style={{
                            color: "var(--color-danger)",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          Remove
                        </button>
                      </Form>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add staff form */}
            {canStaff && (
              <Form method="post" className="flex flex-col gap-3">
                <input type="hidden" name="_intent" value="add_staff" />
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      id="staffHandle"
                      name="staffHandle"
                      type="text"
                      label="Add by handle"
                      placeholder="username"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5" style={{ minWidth: "110px" }}>
                    <label
                      htmlFor="staffRole"
                      className="text-sm font-medium"
                      style={{ color: "var(--color-text)" }}
                    >
                      Role
                    </label>
                    <select
                      id="staffRole"
                      name="staffRole"
                      className="rounded-md px-3 py-2 text-sm"
                      style={{
                        background: "var(--color-bg-elev-2)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text)",
                        outline: "none",
                      }}
                    >
                      <option value="mod">Mod</option>
                      <option value="senior_mod">Senior Mod</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <Button type="submit" variant="secondary" loading={isSubmitting}>
                  Add staff member
                </Button>
              </Form>
            )}
          </div>
        </div>
      </AppShell>
      <Footer />
    </div>
  );
}
