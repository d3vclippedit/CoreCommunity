import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ─── Meta ────────────────────────────────────────────────────────────────────

export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // uuid
  email: text("email").unique().notNull(),
  emailVerifiedAt: integer("email_verified_at", { mode: "timestamp" }),
  handle: text("handle").unique().notNull(), // ^[a-z0-9_]{3,20}$
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  isPlatformAdmin: integer("is_platform_admin", { mode: "boolean" }).notNull().default(false),
  isVerifiedStreamer: integer("is_verified_streamer", { mode: "boolean" }).notNull().default(false),
  // V2: xp, level, reputation columns
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(0),
  reputation: integer("reputation").notNull().default(0),
});

// Sessions stored in KV, not D1.
// Key: session:<token>  Value: { userId, createdAt, expiresAt }

// ─── Email Verifications ──────────────────────────────────────────────────────

export const emailVerifications = sqliteTable("email_verifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").unique().notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ─── Password Resets ──────────────────────────────────────────────────────────

export const passwordResets = sqliteTable("password_resets", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").unique().notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ─── Communities ──────────────────────────────────────────────────────────────

export const communities = sqliteTable("communities", {
  id: text("id").primaryKey(),
  slug: text("slug").unique().notNull(),
  name: text("name").notNull(),
  tagline: text("tagline"),
  description: text("description"),
  rules: text("rules"), // markdown — V2: separate community_rules table
  bannerUrl: text("banner_url"),
  iconUrl: text("icon_url"),
  accentColor: text("accent_color"), // hex, e.g. "#3DD68C"
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  isVerified: integer("is_verified", { mode: "boolean" }).notNull().default(false),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
  memberCount: integer("member_count").notNull().default(0), // denormalized
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
});

// ─── Community Memberships ────────────────────────────────────────────────────

export type CommunityRole = "member" | "mod" | "senior_mod" | "admin" | "streamer";

export const communityMemberships = sqliteTable(
  "community_memberships",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    role: text("role").$type<CommunityRole>().notNull().default("member"),
    joinedAt: integer("joined_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    // V2: reputation: integer
  },
  // PK is (userId, communityId) — set via migration, Drizzle composite PK
);

// ─── Community Sections ───────────────────────────────────────────────────────

export type SectionSlug =
  | "general"
  | "clips"
  | "announcements"
  | "suggestions"
  | "memes"
  | "events"
  | "questions"
  | "updates";

export const communitySections = sqliteTable("community_sections", {
  id: text("id").primaryKey(),
  communityId: text("community_id")
    .notNull()
    .references(() => communities.id, { onDelete: "cascade" }),
  slug: text("slug").$type<SectionSlug>().notNull(),
  name: text("name").notNull(),
  description: text("description"),
  position: integer("position").notNull().default(0),
  postPermission: text("post_permission")
    .$type<"anyone" | "staff_only">()
    .notNull()
    .default("anyone"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ─── Posts ────────────────────────────────────────────────────────────────────

export type PostType = "text" | "image" | "link" | "video" | "poll";
export type EmbedKind = "twitch_clip" | "twitch_vod" | "youtube" | null;

export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  communityId: text("community_id")
    .notNull()
    .references(() => communities.id, { onDelete: "cascade" }),
  sectionId: text("section_id")
    .notNull()
    .references(() => communitySections.id),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id),
  type: text("type").$type<PostType>().notNull().default("text"),
  title: text("title").notNull(),
  body: text("body"), // markdown for text; caption for image/video
  url: text("url"), // for link/video posts
  imageUrl: text("image_url"), // R2 url for image posts
  embedKind: text("embed_kind").$type<EmbedKind>(),
  embedRef: text("embed_ref"), // canonical id parsed from url
  score: integer("score").notNull().default(0), // upvotes - downvotes (denormalized)
  upvotes: integer("upvotes").notNull().default(0),
  downvotes: integer("downvotes").notNull().default(0),
  commentCount: integer("comment_count").notNull().default(0),
  isPinned: integer("is_pinned", { mode: "boolean" }).notNull().default(false),
  isFeatured: integer("is_featured", { mode: "boolean" }).notNull().default(false),
  removedAt: integer("removed_at", { mode: "timestamp" }),
  removedByUserId: text("removed_by_user_id"),
  removedReason: text("removed_reason"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// ─── Comments ─────────────────────────────────────────────────────────────────

export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  postId: text("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  parentCommentId: text("parent_comment_id"), // null = top-level (self-ref, no FK for SQLite compat)
  authorId: text("author_id")
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(), // markdown
  score: integer("score").notNull().default(0),
  upvotes: integer("upvotes").notNull().default(0),
  downvotes: integer("downvotes").notNull().default(0),
  removedAt: integer("removed_at", { mode: "timestamp" }),
  removedByUserId: text("removed_by_user_id"),
  removedReason: text("removed_reason"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// ─── Votes ────────────────────────────────────────────────────────────────────

export type VoteTarget = "post" | "comment";

export const votes = sqliteTable("votes", {
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  targetType: text("target_type").$type<VoteTarget>().notNull(),
  targetId: text("target_id").notNull(),
  value: integer("value").notNull(), // -1, 0, or 1
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  // PK: (userId, targetType, targetId) — set in migration
});

// ─── Reports ──────────────────────────────────────────────────────────────────

export type ReportReason = "spam" | "harassment" | "nsfw" | "off_topic" | "other";
export type ReportStatus = "open" | "actioned" | "dismissed";

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  reporterId: text("reporter_id")
    .notNull()
    .references(() => users.id),
  targetType: text("target_type").$type<VoteTarget>().notNull(),
  targetId: text("target_id").notNull(),
  communityId: text("community_id")
    .notNull()
    .references(() => communities.id),
  reason: text("reason").$type<ReportReason>().notNull(),
  details: text("details"),
  status: text("status").$type<ReportStatus>().notNull().default("open"),
  resolvedByUserId: text("resolved_by_user_id"),
  resolvedAt: integer("resolved_at", { mode: "timestamp" }),
  resolutionNote: text("resolution_note"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ─── Moderation Actions (audit log) ──────────────────────────────────────────

export type ModAction =
  | "remove_post"
  | "remove_comment"
  | "ban_user"
  | "timeout_user"
  | "pin_post"
  | "feature_post"
  | "role_change"
  | "settings_change";

export const moderationActions = sqliteTable("moderation_actions", {
  id: text("id").primaryKey(),
  communityId: text("community_id")
    .notNull()
    .references(() => communities.id, { onDelete: "cascade" }),
  actorId: text("actor_id")
    .notNull()
    .references(() => users.id),
  action: text("action").$type<ModAction>().notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  metadata: text("metadata"), // JSON blob
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ─── Bans / Timeouts ─────────────────────────────────────────────────────────

export const bans = sqliteTable("bans", {
  id: text("id").primaryKey(),
  communityId: text("community_id")
    .notNull()
    .references(() => communities.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  mutedByUserId: text("muted_by_user_id")
    .notNull()
    .references(() => users.id),
  type: text("type").$type<"ban" | "timeout">().notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }), // null = permanent
  reason: text("reason"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ─── Stream Snapshots ─────────────────────────────────────────────────────────
// Periodic snapshots of CORE streamers' live status for the stats page.
// Written every ~5 min when the homepage or /stats page is loaded.

export const streamSnapshots = sqliteTable("stream_snapshots", {
  id: text("id").primaryKey(),
  streamerLogin: text("streamer_login").notNull(),
  viewerCount: integer("viewer_count").notNull().default(0),
  isLive: integer("is_live", { mode: "boolean" }).notNull().default(false),
  streamTitle: text("stream_title"),
  gameName: text("game_name"),
  recordedAt: integer("recorded_at", { mode: "timestamp" }).notNull(),
});

// ─── V2 Stub Tables ───────────────────────────────────────────────────────────
// Created but not wired to UI in V1. Leave // V2: comments at usage sites.

export const badges = sqliteTable("badges", {
  id: text("id").primaryKey(),
  code: text("code").unique().notNull(),
  name: text("name").notNull(),
  description: text("description"),
  iconUrl: text("icon_url"),
  scope: text("scope").$type<"platform" | "community">().notNull(),
  communityId: text("community_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const userBadges = sqliteTable("user_badges", {
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  badgeId: text("badge_id")
    .notNull()
    .references(() => badges.id, { onDelete: "cascade" }),
  awardedAt: integer("awarded_at", { mode: "timestamp" }).notNull(),
  awardedByUserId: text("awarded_by_user_id"),
});

export const follows = sqliteTable("follows", {
  followerId: text("follower_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  followeeId: text("followee_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const bookmarks = sqliteTable("bookmarks", {
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  postId: text("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const postTags = sqliteTable("post_tags", {
  postId: text("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  tag: text("tag").notNull(),
});
