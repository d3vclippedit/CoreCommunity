import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  useRouteLoaderData,
  useSearchParams,
} from "@remix-run/react";
import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { useRef, useState } from "react";
import { AppShell } from "~/components/layout/AppShell";
import { Footer } from "~/components/layout/Footer";
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
  type CustomRoleBase,
  communities,
  communityCustomRoles,
  communityMemberships,
  moderationActions,
  users,
} from "../../db/schema";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data ? `Settings — c/${data.community.slug}` : "Cormunities" },
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

  const customRoles = await db
    .select()
    .from(communityCustomRoles)
    .where(eq(communityCustomRoles.communityId, community.id))
    .orderBy(asc(communityCustomRoles.displayOrder), asc(communityCustomRoles.createdAt));

  return { community, staff, myRole: membership?.role ?? null, customRoles };
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

  // ── General settings ─────────────────────────────────────────────────────
  if (intent === "settings_general") {
    const name = (form.get("name") as string | null)?.trim() ?? "";
    const tagline = (form.get("tagline") as string | null)?.trim() ?? "";
    const description = (form.get("description") as string | null)?.trim() ?? "";
    const rules = (form.get("rules") as string | null)?.trim() ?? "";

    if (!name || name.length < 2 || name.length > 64)
      return { error: "Name must be between 2 and 64 characters.", intent };
    if (tagline.length > 120) return { error: "Tagline must be under 120 characters.", intent };

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

  // ── Appearance settings ───────────────────────────────────────────────────
  if (intent === "settings_appearance") {
    const accentColor = (form.get("accentColor") as string | null)?.trim() ?? "";
    const iconUrl = (form.get("iconUrl") as string | null)?.trim() ?? "";
    const bannerUrl = (form.get("bannerUrl") as string | null)?.trim() ?? "";
    const backgroundCss = (form.get("backgroundCss") as string | null)?.trim() ?? "";
    const twitchChannelRaw = (form.get("twitchChannel") as string | null)?.trim() ?? "";
    const twitchChannel247Raw = (form.get("twitchChannel247") as string | null)?.trim() ?? "";
    // Accept full twitch.tv URLs or bare channel names
    const extractChannel = (v: string) =>
      v ? (v.replace(/^https?:\/\/(www\.)?twitch\.tv\//i, "").split(/[/?#]/)[0] ?? "") : "";
    const twitchChannel = extractChannel(twitchChannelRaw);
    const twitchChannel247 = extractChannel(twitchChannel247Raw);
    const roleColorStreamer = (form.get("roleColorStreamer") as string | null)?.trim() ?? "";
    const roleColorAdmin = (form.get("roleColorAdmin") as string | null)?.trim() ?? "";
    const roleColorSeniorMod = (form.get("roleColorSeniorMod") as string | null)?.trim() ?? "";
    const roleColorMod = (form.get("roleColorMod") as string | null)?.trim() ?? "";

    if (accentColor && !/^#[0-9a-fA-F]{6}$/.test(accentColor))
      return { error: "Accent color must be a valid hex color like #3DD68C.", intent };
    for (const [field, val] of [
      ["Streamer color", roleColorStreamer],
      ["Admin color", roleColorAdmin],
      ["Senior Mod color", roleColorSeniorMod],
      ["Mod color", roleColorMod],
    ] as [string, string][]) {
      if (val && !/^#[0-9a-fA-F]{6}$/.test(val))
        return { error: `${field} must be a valid hex color.`, intent };
    }

    await db
      .update(communities)
      .set({
        accentColor: accentColor || null,
        iconUrl: iconUrl || null,
        bannerUrl: bannerUrl || null,
        backgroundCss: backgroundCss || null,
        twitchChannel: twitchChannel || null,
        twitchChannel247: twitchChannel247 || null,
        roleColorStreamer: roleColorStreamer || null,
        roleColorAdmin: roleColorAdmin || null,
        roleColorSeniorMod: roleColorSeniorMod || null,
        roleColorMod: roleColorMod || null,
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

  // ── Permissions settings ──────────────────────────────────────────────────
  if (intent === "settings_permissions") {
    const memberCanPostLinks = form.get("memberCanPostLinks") === "1";
    const memberCanPostImages = form.get("memberCanPostImages") === "1";
    const memberCanPostVideos = form.get("memberCanPostVideos") === "1";
    const memberPostsPerHourRaw = (form.get("memberPostsPerHour") as string | null)?.trim() ?? "";
    const memberPostsPerHour = memberPostsPerHourRaw === "" ? null : Number(memberPostsPerHourRaw);

    if (memberPostsPerHour !== null && (Number.isNaN(memberPostsPerHour) || memberPostsPerHour < 0))
      return { error: "Posts per hour must be a positive number or blank for no limit.", intent };

    await db
      .update(communities)
      .set({
        memberCanPostLinks,
        memberCanPostImages,
        memberCanPostVideos,
        memberPostsPerHour,
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

  // ── Create custom role ────────────────────────────────────────────────────
  if (intent === "create_role") {
    const roleName = (form.get("roleName") as string | null)?.trim() ?? "";
    const roleColor = (form.get("roleColor") as string | null)?.trim() ?? "";
    const baseRole = (form.get("baseRole") as string | null) ?? "member";
    const canPostLinks = form.get("canPostLinks") === "1";
    const canPostImages = form.get("canPostImages") === "1";
    const canPostVideos = form.get("canPostVideos") === "1";
    const postsPerHourRaw = (form.get("postsPerHour") as string | null)?.trim() ?? "";
    const postsPerHour = postsPerHourRaw === "" ? null : Number(postsPerHourRaw);

    if (!roleName || roleName.length < 1 || roleName.length > 32)
      return { error: "Role name must be 1–32 characters.", intent };
    if (roleColor && !/^#[0-9a-fA-F]{6}$/.test(roleColor))
      return { error: "Role color must be a valid hex color.", intent };
    if (postsPerHour !== null && (Number.isNaN(postsPerHour) || postsPerHour < 0))
      return { error: "Posts per hour must be a positive number or blank for no limit.", intent };

    const validBases: CustomRoleBase[] = ["member", "mod", "senior_mod", "admin"];
    if (!validBases.includes(baseRole as CustomRoleBase))
      return { error: "Invalid moderation level.", intent };

    const now = new Date();
    await db.insert(communityCustomRoles).values({
      id: generateId(),
      communityId: community.id,
      name: roleName,
      color: roleColor || null,
      baseRole: baseRole as CustomRoleBase,
      canPostLinks,
      canPostImages,
      canPostVideos,
      postsPerHour,
      displayOrder: 0,
      createdAt: now,
      updatedAt: now,
    });

    return { ok: true, intent };
  }

  // ── Delete custom role ────────────────────────────────────────────────────
  if (intent === "delete_role") {
    const roleId = (form.get("roleId") as string | null) ?? "";
    if (!roleId) return { error: "Missing role ID.", intent };

    await db
      .delete(communityCustomRoles)
      .where(
        and(
          eq(communityCustomRoles.id, roleId),
          eq(communityCustomRoles.communityId, community.id),
        ),
      );

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
  const { community, staff, myRole, customRoles } = useLoaderData<typeof loader>();
  const data = useActionData<typeof action>();
  const nav = useNavigation();
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const user = root?.user ?? null;
  const [params, setParams] = useSearchParams();

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

  const submittingIntent =
    nav.state === "submitting"
      ? ((nav.formData?.get("_intent") as string | null) ?? "settings_general")
      : null;

  const settingsOk =
    data &&
    "ok" in data &&
    data.ok &&
    (data.intent === "settings_general" ||
      data.intent === "settings_appearance" ||
      data.intent === "settings_permissions");
  const roleOk =
    data &&
    "ok" in data &&
    data.ok &&
    (data.intent === "create_role" || data.intent === "delete_role");
  const staffOk =
    data &&
    "ok" in data &&
    data.ok &&
    (data.intent === "add_staff" || data.intent === "remove_staff");
  const errorMsg = data && "error" in data ? data.error : null;

  const ROLE_LABELS: Record<string, string> = {
    streamer: "Streamer",
    admin: "Admin",
    senior_mod: "Senior Mod",
    mod: "Mod",
  };

  const BASE_ROLE_LABELS: Record<string, string> = {
    member: "No mod access",
    mod: "Mod",
    senior_mod: "Senior Mod",
    admin: "Admin",
  };

  const cardStyle = {
    background: "var(--color-bg-elev-1)",
    border: "1px solid var(--color-border)",
  };

  type SettingsTab = "general" | "appearance" | "permissions" | "roles" | "staff";
  const activeTab = (params.get("tab") ?? "general") as SettingsTab;
  const TABS: { id: SettingsTab; label: string }[] = [
    { id: "general", label: "General" },
    { id: "appearance", label: "Appearance" },
    { id: "permissions", label: "Permissions" },
    { id: "roles", label: "Roles" },
    { id: "staff", label: "Staff" },
  ];

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--color-bg)" }}>
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

          {/* Tab bar */}
          <div
            className="flex rounded-lg overflow-hidden"
            style={{
              border: "1px solid var(--color-border)",
              background: "var(--color-bg-elev-1)",
            }}
          >
            {TABS.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setParams(t.id === "general" ? {} : { tab: t.id })}
                className="flex-1 py-2 text-xs font-medium transition-colors"
                style={{
                  background: activeTab === t.id ? "var(--color-bg-elev-2)" : "transparent",
                  border: "none",
                  borderRight: i < TABS.length - 1 ? "1px solid var(--color-border)" : "none",
                  color: activeTab === t.id ? "var(--color-text)" : "var(--color-text-faint)",
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {settingsOk && <Alert variant="success">Settings saved.</Alert>}
          {roleOk && <Alert variant="success">Roles updated.</Alert>}
          {staffOk && <Alert variant="success">Staff updated.</Alert>}
          {errorMsg && <Alert variant="error">{errorMsg}</Alert>}

          {/* ── General tab ── */}
          {activeTab === "general" && (
            <div className="rounded-lg p-6" style={cardStyle}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text)" }}>
                General
              </h2>
              <Form method="post" className="flex flex-col gap-4">
                <input type="hidden" name="_intent" value="settings_general" />
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
                <Button
                  type="submit"
                  loading={submittingIntent === "settings_general" && isSubmitting}
                  className="w-full"
                >
                  Save general settings
                </Button>
              </Form>
            </div>
          )}

          {/* ── Appearance tab ── */}
          {activeTab === "appearance" && (
            <div className="rounded-lg p-6" style={cardStyle}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text)" }}>
                Appearance
              </h2>
              <Form method="post" className="flex flex-col gap-4">
                <input type="hidden" name="_intent" value="settings_appearance" />
                <ImageUploadField
                  name="iconUrl"
                  label="Community icon"
                  hint="256×256px recommended · Square · PNG, JPG, or WebP · Max 2 MB"
                  imageType="icon"
                  communitySlug={community.slug}
                  currentUrl={community.iconUrl}
                />
                <ImageUploadField
                  name="bannerUrl"
                  label="Hero banner"
                  hint="1200×400px recommended · 3:1 ratio · PNG, JPG, or WebP · Max 4 MB"
                  imageType="banner"
                  communitySlug={community.slug}
                  currentUrl={community.bannerUrl}
                />
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
                <BackgroundEditor
                  communitySlug={community.slug}
                  defaultValue={community.backgroundCss}
                />
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="twitchChannel"
                    className="text-sm font-medium"
                    style={{ color: "var(--color-text)" }}
                  >
                    Twitch channel
                  </label>
                  <input
                    type="text"
                    id="twitchChannel"
                    name="twitchChannel"
                    defaultValue={community.twitchChannel ?? ""}
                    placeholder="e.g. xqc"
                    className="rounded-md px-3 py-2 text-sm"
                    style={{
                      background: "var(--color-bg-elev-2)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                      outline: "none",
                    }}
                  />
                  <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                    Your Twitch username. Shows live stream + chat in the community sidebar when you
                    go live.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="twitchChannel247"
                    className="text-sm font-medium"
                    style={{ color: "var(--color-text)" }}
                  >
                    24/7 Twitch channel
                  </label>
                  <input
                    type="text"
                    id="twitchChannel247"
                    name="twitchChannel247"
                    defaultValue={community.twitchChannel247 ?? ""}
                    placeholder="e.g. xqc247"
                    className="rounded-md px-3 py-2 text-sm"
                    style={{
                      background: "var(--color-bg-elev-2)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                      outline: "none",
                    }}
                  />
                  <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                    Optional. Shown in the sidebar while your main channel is offline — great for
                    24/7 VOD or rerun channels.
                  </p>
                </div>
                <div
                  className="rounded-md p-4 flex flex-col gap-3"
                  style={{
                    background: "var(--color-bg-elev-2)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <p
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--color-text-faint)" }}
                  >
                    Staff role colors
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                    Colors shown on staff badges in the community sidebar.
                  </p>
                  <RoleColorPicker
                    name="roleColorStreamer"
                    label="Streamer / Owner"
                    defaultValue={community.roleColorStreamer ?? "#F59E0B"}
                  />
                  <RoleColorPicker
                    name="roleColorAdmin"
                    label="Admin"
                    defaultValue={community.roleColorAdmin ?? "#A855F7"}
                  />
                  <RoleColorPicker
                    name="roleColorSeniorMod"
                    label="Senior Mod"
                    defaultValue={community.roleColorSeniorMod ?? "#3B82F6"}
                  />
                  <RoleColorPicker
                    name="roleColorMod"
                    label="Mod"
                    defaultValue={community.roleColorMod ?? "#22C55E"}
                  />
                </div>
                <Button
                  type="submit"
                  loading={submittingIntent === "settings_appearance" && isSubmitting}
                  className="w-full"
                >
                  Save appearance
                </Button>
              </Form>
            </div>
          )}

          {/* ── Permissions tab ── */}
          {activeTab === "permissions" && (
            <div className="rounded-lg p-6" style={cardStyle}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text)" }}>
                Member permissions
              </h2>
              <Form method="post" className="flex flex-col gap-4">
                <input type="hidden" name="_intent" value="settings_permissions" />
                <div
                  className="rounded-md p-4 flex flex-col gap-3"
                  style={{
                    background: "var(--color-bg-elev-2)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <p
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--color-text-faint)" }}
                  >
                    Default member permissions
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                    What regular members (no custom role) can post. Staff always bypass these.
                  </p>
                  <PermissionCheckbox
                    name="memberCanPostLinks"
                    label="Can post links"
                    defaultChecked={community.memberCanPostLinks}
                  />
                  <PermissionCheckbox
                    name="memberCanPostImages"
                    label="Can post images"
                    defaultChecked={community.memberCanPostImages}
                  />
                  <PermissionCheckbox
                    name="memberCanPostVideos"
                    label="Can post videos"
                    defaultChecked={community.memberCanPostVideos}
                  />
                  <div className="flex items-center gap-3">
                    <label
                      htmlFor="memberPostsPerHour"
                      className="text-sm"
                      style={{ color: "var(--color-text-dim)" }}
                    >
                      Post rate limit
                    </label>
                    <input
                      id="memberPostsPerHour"
                      type="number"
                      name="memberPostsPerHour"
                      min={0}
                      step={1}
                      defaultValue={community.memberPostsPerHour ?? ""}
                      placeholder="No limit"
                      className="w-24 rounded-md px-2 py-1.5 text-sm"
                      style={{
                        background: "var(--color-bg-elev-1)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text)",
                        outline: "none",
                      }}
                    />
                    <span className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                      posts / hour
                    </span>
                  </div>
                </div>
                <Button
                  type="submit"
                  loading={submittingIntent === "settings_permissions" && isSubmitting}
                  className="w-full"
                >
                  Save permissions
                </Button>
              </Form>
            </div>
          )}

          {/* ── Roles tab ── */}
          {activeTab === "roles" && (
            <div className="rounded-lg p-6" style={cardStyle}>
              <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--color-text)" }}>
                Custom member roles
              </h2>
              <p className="text-xs mb-4" style={{ color: "var(--color-text-faint)" }}>
                Create roles like "VIP" or "Content Creator". Each role can unlock specific post
                types and get a boosted post rate limit.
              </p>

              {customRoles.length === 0 ? (
                <p className="text-sm mb-4" style={{ color: "var(--color-text-faint)" }}>
                  No custom roles yet.
                </p>
              ) : (
                <div
                  className="flex flex-col divide-y mb-4"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  {customRoles.map((role) => (
                    <div key={role.id} className="flex items-start justify-between py-3 gap-3">
                      <div className="flex flex-col gap-1.5 min-w-0">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium self-start"
                          style={{
                            background: role.color ? `${role.color}22` : "var(--color-bg-elev-2)",
                            color: role.color ?? "var(--color-text-dim)",
                            border: `1px solid ${role.color ?? "var(--color-border)"}`,
                          }}
                        >
                          {role.name}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          <PermTag active={true} label="Text" />
                          <PermTag active={role.canPostLinks} label="Links" />
                          <PermTag active={role.canPostImages} label="Images" />
                          <PermTag active={role.canPostVideos} label="Videos" />
                          {role.postsPerHour !== null && role.postsPerHour !== undefined ? (
                            <PermTag active={true} label={`${role.postsPerHour}/hr`} />
                          ) : (
                            <PermTag active={false} label="default rate" faint />
                          )}
                          <span
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{
                              background: "var(--color-bg-elev-2)",
                              color: "var(--color-text-faint)",
                              border: "1px solid var(--color-border)",
                            }}
                          >
                            {BASE_ROLE_LABELS[role.baseRole]}
                          </span>
                        </div>
                      </div>
                      <Form method="post" className="flex-shrink-0">
                        <input type="hidden" name="_intent" value="delete_role" />
                        <input type="hidden" name="roleId" value={role.id} />
                        <button
                          type="submit"
                          className="text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
                          style={{
                            color: "var(--color-danger)",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          Delete
                        </button>
                      </Form>
                    </div>
                  ))}
                </div>
              )}

              {/* Create role form */}
              <Form method="post" className="flex flex-col gap-4">
                <input type="hidden" name="_intent" value="create_role" />

                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Input
                      id="roleName"
                      name="roleName"
                      type="text"
                      label="Role name"
                      placeholder="VIP"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="roleColorPicker"
                      className="text-sm font-medium"
                      style={{ color: "var(--color-text)" }}
                    >
                      Color
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        id="roleColorPicker"
                        defaultValue="#3DD68C"
                        onChange={(e) => {
                          const input = document.getElementById("roleColor") as HTMLInputElement;
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
                        id="roleColor"
                        name="roleColor"
                        defaultValue="#3DD68C"
                        placeholder="#3DD68C"
                        className="w-24 rounded-md px-2 py-2 text-sm font-mono"
                        style={{
                          background: "var(--color-bg-elev-2)",
                          border: "1px solid var(--color-border)",
                          color: "var(--color-text)",
                          outline: "none",
                        }}
                        onChange={(e) => {
                          if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                            const picker = document.getElementById(
                              "roleColorPicker",
                            ) as HTMLInputElement;
                            if (picker) picker.value = e.target.value;
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Permission checklist */}
                <div
                  className="rounded-md p-4 flex flex-col gap-3"
                  style={{
                    background: "var(--color-bg-elev-2)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <p
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--color-text-faint)" }}
                  >
                    Content permissions
                  </p>
                  <PermissionCheckbox
                    name="canPostLinks"
                    label="Can post links"
                    defaultChecked={true}
                  />
                  <PermissionCheckbox
                    name="canPostImages"
                    label="Can post images"
                    defaultChecked={true}
                  />
                  <PermissionCheckbox
                    name="canPostVideos"
                    label="Can post videos"
                    defaultChecked={true}
                  />
                  <div
                    className="flex items-center gap-3 pt-1"
                    style={{ borderTop: "1px solid var(--color-border)" }}
                  >
                    <label
                      htmlFor="postsPerHour"
                      className="text-sm"
                      style={{ color: "var(--color-text-dim)" }}
                    >
                      Post rate limit
                    </label>
                    <input
                      id="postsPerHour"
                      type="number"
                      name="postsPerHour"
                      min={0}
                      step={1}
                      placeholder="No limit"
                      className="w-24 rounded-md px-2 py-1.5 text-sm"
                      style={{
                        background: "var(--color-bg-elev-1)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text)",
                        outline: "none",
                      }}
                    />
                    <span className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                      posts / hour (blank = no limit)
                    </span>
                  </div>
                </div>

                {/* Moderation access */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="baseRole"
                    className="text-sm font-medium"
                    style={{ color: "var(--color-text)" }}
                  >
                    Moderation access
                  </label>
                  <select
                    id="baseRole"
                    name="baseRole"
                    className="rounded-md px-3 py-2 text-sm"
                    style={{
                      background: "var(--color-bg-elev-2)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                      outline: "none",
                    }}
                  >
                    <option value="member">None — regular member</option>
                    <option value="mod">Mod — remove posts + timeout users</option>
                    <option value="senior_mod">Senior Mod — ban + feature posts</option>
                    <option value="admin">Admin — full community access</option>
                  </select>
                  <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                    Controls whether this role can take moderation actions.
                  </p>
                </div>

                <Button
                  type="submit"
                  variant="secondary"
                  loading={submittingIntent === "create_role" && isSubmitting}
                >
                  Create role
                </Button>
              </Form>
            </div>
          )}

          {/* ── Staff tab ── */}
          {activeTab === "staff" && (
            <div className="rounded-lg p-6" style={cardStyle}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text)" }}>
                Staff
              </h2>

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
                        <span
                          className="text-sm font-medium"
                          style={{ color: "var(--color-text)" }}
                        >
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
                  <Button
                    type="submit"
                    variant="secondary"
                    loading={submittingIntent === "add_staff" && isSubmitting}
                  >
                    Add staff member
                  </Button>
                </Form>
              )}
            </div>
          )}
        </div>
      </AppShell>
      <Footer />
    </div>
  );
}

function ImageUploadField({
  name,
  label,
  hint,
  imageType,
  communitySlug,
  currentUrl,
}: {
  name: string;
  label: string;
  hint: string;
  imageType: "icon" | "banner";
  communitySlug: string;
  currentUrl?: string | null;
}) {
  const [url, setUrl] = useState(currentUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("communitySlug", communitySlug);
      fd.append("imageType", imageType);
      const res = await fetch("/api/upload/community-image", { method: "POST", body: fd });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setError(json.error ?? "Upload failed");
      } else {
        setUrl(json.url);
      }
    } catch {
      setError("Upload failed. Check your connection.");
    } finally {
      setUploading(false);
    }
  }

  const previewW = imageType === "icon" ? 48 : 96;
  const previewH = imageType === "icon" ? 48 : 32;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
        {label}
      </span>
      <input type="hidden" name={name} value={url} />
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <div className="flex items-center gap-3">
        {url && (
          <img
            src={url}
            alt=""
            className="rounded object-cover flex-shrink-0"
            style={{ width: previewW, height: previewH, border: "1px solid var(--color-border)" }}
          />
        )}
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="px-3 py-1.5 text-sm rounded-md transition-colors"
          style={{
            background: "var(--color-bg-elev-2)",
            border: "1px solid var(--color-border)",
            color: uploading ? "var(--color-text-faint)" : "var(--color-text)",
            cursor: uploading ? "not-allowed" : "pointer",
          }}
        >
          {uploading ? "Uploading…" : url ? "Change image" : "Upload image"}
        </button>
        {url && (
          <button
            type="button"
            onClick={() => setUrl("")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--color-text-faint)",
              fontSize: "0.75rem",
            }}
          >
            Remove
          </button>
        )}
      </div>
      {error && (
        <p className="text-xs" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      )}
      <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
        {hint}
      </p>
    </div>
  );
}

type BgTab = "none" | "color" | "gradient" | "image";

function parseBgCss(css: string | null | undefined): {
  tab: BgTab;
  color: string;
  gradStop1: string;
  gradStop2: string;
  gradAngle: number;
  imageUrl: string;
} {
  const v = (css ?? "").trim();
  if (!v)
    return {
      tab: "none",
      color: "#0a0a0c",
      gradStop1: "#0f0c29",
      gradStop2: "#302b63",
      gradAngle: 135,
      imageUrl: "",
    };
  if (v.startsWith("#"))
    return {
      tab: "color",
      color: v,
      gradStop1: "#0f0c29",
      gradStop2: "#302b63",
      gradAngle: 135,
      imageUrl: "",
    };
  const gradMatch = v.match(
    /^linear-gradient\((\d+)deg,\s*(#[0-9a-fA-F]{6}),\s*(#[0-9a-fA-F]{6})\)/,
  );
  if (gradMatch)
    return {
      tab: "gradient",
      color: "#0a0a0c",
      gradStop1: gradMatch[2],
      gradStop2: gradMatch[3],
      gradAngle: Number(gradMatch[1]),
      imageUrl: "",
    };
  if (v.startsWith("linear-gradient"))
    return {
      tab: "gradient",
      color: "#0a0a0c",
      gradStop1: "#0f0c29",
      gradStop2: "#302b63",
      gradAngle: 135,
      imageUrl: "",
    };
  const urlMatch = v.match(/^url\(['"]?([^'")\s]+)['"]?\)/);
  if (urlMatch)
    return {
      tab: "image",
      color: "#0a0a0c",
      gradStop1: "#0f0c29",
      gradStop2: "#302b63",
      gradAngle: 135,
      imageUrl: urlMatch[1],
    };
  return {
    tab: "none",
    color: "#0a0a0c",
    gradStop1: "#0f0c29",
    gradStop2: "#302b63",
    gradAngle: 135,
    imageUrl: "",
  };
}

const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const ANGLE_ARROWS: Record<number, string> = {
  0: "↑",
  45: "↗",
  90: "→",
  135: "↘",
  180: "↓",
  225: "↙",
  270: "←",
  315: "↖",
};

function BackgroundEditor({
  communitySlug,
  defaultValue,
}: { communitySlug: string; defaultValue: string | null | undefined }) {
  const parsed = parseBgCss(defaultValue);
  const [tab, setTab] = useState<BgTab>(parsed.tab);
  const [color, setColor] = useState(parsed.color);
  const [gradStop1, setGradStop1] = useState(parsed.gradStop1);
  const [gradStop2, setGradStop2] = useState(parsed.gradStop2);
  const [gradAngle, setGradAngle] = useState(parsed.gradAngle);
  const [imageUrl, setImageUrl] = useState(parsed.imageUrl);
  const [bgUploading, setBgUploading] = useState(false);
  const [bgUploadError, setBgUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  let bgCss = "";
  if (tab === "color") bgCss = color;
  else if (tab === "gradient")
    bgCss = `linear-gradient(${gradAngle}deg, ${gradStop1}, ${gradStop2})`;
  else if (tab === "image" && imageUrl) bgCss = `url(${imageUrl}) center/cover no-repeat fixed`;

  async function handleBgFile(file: File) {
    setBgUploadError(null);
    setBgUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("communitySlug", communitySlug);
      fd.append("imageType", "background");
      const res = await fetch("/api/upload/community-image", { method: "POST", body: fd });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setBgUploadError(json.error ?? "Upload failed");
      } else {
        setImageUrl(json.url);
      }
    } catch {
      setBgUploadError("Upload failed. Check your connection.");
    } finally {
      setBgUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
        Page background
      </span>
      <input type="hidden" name="backgroundCss" value={bgCss} />
      <div
        className="flex rounded-md overflow-hidden"
        style={{ border: "1px solid var(--color-border)" }}
      >
        {(["none", "color", "gradient", "image"] as BgTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="flex-1 py-1.5 text-xs capitalize transition-colors"
            style={{
              background: tab === t ? "var(--color-bg-elev-2)" : "transparent",
              border: "none",
              color: tab === t ? "var(--color-text)" : "var(--color-text-faint)",
              cursor: "pointer",
              fontWeight: tab === t ? 600 : 400,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "none" && (
        <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
          Default dark background — no custom background applied.
        </p>
      )}

      {tab === "color" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-10 h-9 rounded cursor-pointer"
              style={{
                border: "1px solid var(--color-border)",
                padding: "2px",
                background: "var(--color-bg-elev-2)",
              }}
            />
            <input
              type="text"
              value={color}
              placeholder="#0a0a0c"
              pattern="#[0-9a-fA-F]{6}"
              className="flex-1 rounded-md px-3 py-2 text-sm font-mono"
              style={{
                background: "var(--color-bg-elev-2)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
                outline: "none",
              }}
              onChange={(e) => {
                if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) setColor(e.target.value);
              }}
            />
          </div>
          <div
            className="h-8 rounded-md"
            style={{ background: color, border: "1px solid var(--color-border)" }}
          />
        </div>
      )}

      {tab === "gradient" && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <div className="flex flex-col gap-1 flex-1">
              <span className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                Stop 1
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={gradStop1}
                  onChange={(e) => setGradStop1(e.target.value)}
                  className="w-9 h-8 rounded cursor-pointer flex-shrink-0"
                  style={{
                    border: "1px solid var(--color-border)",
                    padding: "2px",
                    background: "var(--color-bg-elev-2)",
                  }}
                />
                <input
                  type="text"
                  value={gradStop1}
                  placeholder="#0f0c29"
                  className="flex-1 min-w-0 rounded-md px-2 py-1.5 text-xs font-mono"
                  style={{
                    background: "var(--color-bg-elev-2)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                    outline: "none",
                  }}
                  onChange={(e) => {
                    if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) setGradStop1(e.target.value);
                  }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <span className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                Stop 2
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={gradStop2}
                  onChange={(e) => setGradStop2(e.target.value)}
                  className="w-9 h-8 rounded cursor-pointer flex-shrink-0"
                  style={{
                    border: "1px solid var(--color-border)",
                    padding: "2px",
                    background: "var(--color-bg-elev-2)",
                  }}
                />
                <input
                  type="text"
                  value={gradStop2}
                  placeholder="#302b63"
                  className="flex-1 min-w-0 rounded-md px-2 py-1.5 text-xs font-mono"
                  style={{
                    background: "var(--color-bg-elev-2)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                    outline: "none",
                  }}
                  onChange={(e) => {
                    if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) setGradStop2(e.target.value);
                  }}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: "var(--color-text-faint)" }}>
              Direction
            </span>
            <div className="flex gap-0.5">
              {ANGLES.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setGradAngle(a)}
                  className="w-8 h-8 text-sm rounded transition-colors"
                  style={{
                    background: gradAngle === a ? "var(--color-bg-elev-2)" : "transparent",
                    border:
                      gradAngle === a ? "1px solid var(--color-border)" : "1px solid transparent",
                    color: gradAngle === a ? "var(--color-text)" : "var(--color-text-faint)",
                    cursor: "pointer",
                  }}
                >
                  {ANGLE_ARROWS[a]}
                </button>
              ))}
            </div>
          </div>
          <div
            className="h-8 rounded-md"
            style={{
              background: `linear-gradient(${gradAngle}deg, ${gradStop1}, ${gradStop2})`,
              border: "1px solid var(--color-border)",
            }}
          />
        </div>
      )}

      {tab === "image" && (
        <div className="flex flex-col gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleBgFile(f);
              e.target.value = "";
            }}
          />
          <div className="flex items-center gap-3">
            {imageUrl && (
              <img
                src={imageUrl}
                alt=""
                className="rounded object-cover flex-shrink-0"
                style={{ width: 80, height: 40, border: "1px solid var(--color-border)" }}
              />
            )}
            <button
              type="button"
              disabled={bgUploading}
              onClick={() => fileRef.current?.click()}
              className="px-3 py-1.5 text-sm rounded-md transition-colors"
              style={{
                background: "var(--color-bg-elev-2)",
                border: "1px solid var(--color-border)",
                color: bgUploading ? "var(--color-text-faint)" : "var(--color-text)",
                cursor: bgUploading ? "not-allowed" : "pointer",
              }}
            >
              {bgUploading ? "Uploading…" : imageUrl ? "Change image" : "Upload image"}
            </button>
            {imageUrl && (
              <button
                type="button"
                onClick={() => setImageUrl("")}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--color-text-faint)",
                  fontSize: "0.75rem",
                }}
              >
                Remove
              </button>
            )}
          </div>
          {bgUploadError && (
            <p className="text-xs" style={{ color: "var(--color-danger)" }}>
              {bgUploadError}
            </p>
          )}
          <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
            Recommended 1920×1080px or wider · PNG, JPG, or WebP · Max 8 MB · Fills the page
            background
          </p>
        </div>
      )}
    </div>
  );
}

function PermissionCheckbox({
  name,
  label,
  defaultChecked,
}: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <input
        type="checkbox"
        name={name}
        value="1"
        defaultChecked={defaultChecked}
        className="w-4 h-4 rounded cursor-pointer"
      />
      <span className="text-sm" style={{ color: "var(--color-text-dim)" }}>
        {label}
      </span>
    </label>
  );
}

function RoleColorPicker({
  name,
  label,
  defaultValue,
}: { name: string; label: string; defaultValue: string }) {
  const pickerId = `${name}Picker`;
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        id={pickerId}
        defaultValue={defaultValue}
        onChange={(e) => {
          const input = document.getElementById(name) as HTMLInputElement;
          if (input) input.value = e.target.value;
        }}
        className="w-8 h-8 rounded cursor-pointer flex-shrink-0"
        style={{
          border: "1px solid var(--color-border)",
          padding: "2px",
          background: "var(--color-bg-elev-2)",
        }}
      />
      <span className="text-sm flex-1" style={{ color: "var(--color-text-dim)" }}>
        {label}
      </span>
      <input
        type="text"
        id={name}
        name={name}
        defaultValue={defaultValue}
        pattern="#[0-9a-fA-F]{6}"
        className="w-24 rounded-md px-2 py-1.5 text-xs font-mono text-right"
        style={{
          background: "var(--color-bg-elev-1)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text)",
          outline: "none",
        }}
        onChange={(e) => {
          if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
            const picker = document.getElementById(pickerId) as HTMLInputElement;
            if (picker) picker.value = e.target.value;
          }
        }}
      />
    </div>
  );
}

function PermTag({ active, label, faint }: { active: boolean; label: string; faint?: boolean }) {
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded"
      style={{
        background: active && !faint ? "var(--color-success)22" : "var(--color-bg-elev-2)",
        color: active && !faint ? "var(--color-success)" : "var(--color-text-faint)",
        border: `1px solid ${active && !faint ? "var(--color-success)44" : "var(--color-border)"}`,
        textDecoration: !active && !faint ? "line-through" : undefined,
      }}
    >
      {label}
    </span>
  );
}
