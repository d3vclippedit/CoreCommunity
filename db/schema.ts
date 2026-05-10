import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
  isBanned: integer("is_banned", { mode: "boolean" }).notNull().default(false),
  earningTier: text("earning_tier")
    .$type<"none" | "creator" | "partner" | "pioneer">()
    .notNull()
    .default("none"),
  // V2: xp, level, reputation columns
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(0),
  reputation: integer("reputation").notNull().default(0),
  followerCount: integer("follower_count").notNull().default(0),
  followingCount: integer("following_count").notNull().default(0),
  // 2FA
  totpSecret: text("totp_secret"),
  totpEnabled: integer("totp_enabled", { mode: "boolean" }).notNull().default(false),
  // Twitch account link
  twitchId: text("twitch_id"),
  twitchUsername: text("twitch_username"),
  twitchLinkedAt: integer("twitch_linked_at", { mode: "timestamp" }),
  twitchUrl: text("twitch_url"),
  // Unlocked by spending $50+ on Core Coins
  gifAvatarUnlocked: integer("gif_avatar_unlocked", { mode: "boolean" }).notNull().default(false),
  // Notification preferences
  notifyOnPostComment: integer("notify_on_post_comment", { mode: "boolean" })
    .notNull()
    .default(true),
  notifyOnPostUpvote: integer("notify_on_post_upvote", { mode: "boolean" }).notNull().default(true),
  notifyOnCommentReply: integer("notify_on_comment_reply", { mode: "boolean" })
    .notNull()
    .default(true),
  notifyOnCommentLike: integer("notify_on_comment_like", { mode: "boolean" })
    .notNull()
    .default(true),
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
  backgroundCss: text("background_css"), // e.g. "#1a1a2e" or "linear-gradient(...)" or url(...)
  memberCanPostLinks: integer("member_can_post_links", { mode: "boolean" }).notNull().default(true),
  memberCanPostImages: integer("member_can_post_images", { mode: "boolean" })
    .notNull()
    .default(true),
  memberCanPostVideos: integer("member_can_post_videos", { mode: "boolean" })
    .notNull()
    .default(true),
  memberPostsPerHour: integer("member_posts_per_hour"), // null = system default (10)
  twitchChannel: text("twitch_channel"),
  twitchChannel247: text("twitch_channel_247"),
  roleColorStreamer: text("role_color_streamer"),
  roleColorAdmin: text("role_color_admin"),
  roleColorSeniorMod: text("role_color_senior_mod"),
  roleColorMod: text("role_color_mod"),
  roleBorderStreamer: text("role_border_streamer"),
  roleBorderAdmin: text("role_border_admin"),
  roleBorderSeniorMod: text("role_border_senior_mod"),
  roleBorderMod: text("role_border_mod"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  isVerified: integer("is_verified", { mode: "boolean" }).notNull().default(false),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
  memberCount: integer("member_count").notNull().default(0), // denormalized
  // Paid membership programme
  membershipEnabled: integer("membership_enabled", { mode: "boolean" }).notNull().default(false),
  membershipPriceCoins: integer("membership_price_coins").notNull().default(500),
  membershipBadgeIcon: text("membership_badge_icon").notNull().default("⭐"),
  membershipBorderColor: text("membership_border_color").notNull().default("#F59E0B"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
});

// ─── Community Custom Roles ───────────────────────────────────────────────────

export type CustomRoleBase = "member" | "mod" | "senior_mod" | "admin";

export const communityCustomRoles = sqliteTable("community_custom_roles", {
  id: text("id").primaryKey(),
  communityId: text("community_id")
    .notNull()
    .references(() => communities.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color"), // hex, shown as role badge color
  baseRole: text("base_role").$type<CustomRoleBase>().notNull().default("member"),
  // Content permissions — override community member defaults for this role
  canPostLinks: integer("can_post_links", { mode: "boolean" }).notNull().default(true),
  canPostImages: integer("can_post_images", { mode: "boolean" }).notNull().default(true),
  canPostVideos: integer("can_post_videos", { mode: "boolean" }).notNull().default(true),
  postsPerHour: integer("posts_per_hour"), // null = use community default
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
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
    customRoleId: text("custom_role_id").references(() => communityCustomRoles.id, {
      onDelete: "set null",
    }),
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

export type PostType = "text" | "image" | "link" | "video" | "poll" | "giveaway";
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
  badgeScore: real("badge_score").notNull().default(0), // accumulated badge visibility weight
  viewCount: integer("view_count").notNull().default(0),
  upvotes: integer("upvotes").notNull().default(0),
  downvotes: integer("downvotes").notNull().default(0),
  commentCount: integer("comment_count").notNull().default(0),
  isPinned: integer("is_pinned", { mode: "boolean" }).notNull().default(false),
  isFeatured: integer("is_featured", { mode: "boolean" }).notNull().default(false),
  visibility: text("visibility").$type<"public" | "members_only">().notNull().default("public"),
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

export type ReportTargetType = "post" | "comment" | "community";
export type ReportReason = "spam" | "harassment" | "nsfw" | "off_topic" | "other";
export type ReportStatus = "open" | "actioned" | "dismissed";

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  reporterId: text("reporter_id")
    .notNull()
    .references(() => users.id),
  targetType: text("target_type").$type<ReportTargetType>().notNull(),
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

// ─── Core Coins / Monetization ────────────────────────────────────────────────

export const coinBundles = sqliteTable("coin_bundles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  usdPriceCents: integer("usd_price_cents").notNull(),
  coinAmount: integer("coin_amount").notNull(),
  bonusLabel: text("bonus_label"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const coinWallets = sqliteTable("coin_wallets", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  totalPurchased: integer("total_purchased").notNull().default(0),
  totalSpent: integer("total_spent").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export type CoinTxType = "purchase" | "spend" | "refund" | "admin_credit" | "admin_debit";

export const coinTransactions = sqliteTable("coin_transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").$type<CoinTxType>().notNull(),
  amount: integer("amount").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  refType: text("ref_type"),
  refId: text("ref_id"),
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type PaymentProvider = "paypal" | "crypto";
export type PaymentStatus = "pending" | "completed" | "failed" | "refunded" | "chargeback";

export const paymentOrders = sqliteTable("payment_orders", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  bundleId: text("bundle_id")
    .notNull()
    .references(() => coinBundles.id),
  usdAmountCents: integer("usd_amount_cents").notNull(),
  coinAmount: integer("coin_amount").notNull(),
  provider: text("provider").$type<PaymentProvider>().notNull(),
  providerOrderId: text("provider_order_id"),
  providerTxId: text("provider_tx_id"),
  status: text("status").$type<PaymentStatus>().notNull().default("pending"),
  ipAddress: text("ip_address"),
  metadata: text("metadata"),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const paymentWebhookEvents = sqliteTable("payment_webhook_events", {
  id: text("id").primaryKey(),
  provider: text("provider").$type<PaymentProvider>().notNull(),
  eventId: text("event_id").notNull(),
  eventType: text("event_type").notNull(),
  payload: text("payload").notNull(),
  orderId: text("order_id"),
  processed: integer("processed", { mode: "boolean" }).notNull().default(false),
  error: text("error"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const postBadgeDefinitions = sqliteTable("post_badge_definitions", {
  id: text("id").primaryKey(),
  code: text("code").unique().notNull(),
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  iconUrl: text("icon_url"), // optional image/GIF override — takes priority over icon emoji
  coinCost: integer("coin_cost").notNull(),
  usdValueCents: integer("usd_value_cents").notNull(),
  visibilityWeight: real("visibility_weight").notNull().default(1.0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const postBadgeApplications = sqliteTable("post_badge_applications", {
  id: text("id").primaryKey(),
  postId: text("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  communityId: text("community_id")
    .notNull()
    .references(() => communities.id, { onDelete: "cascade" }),
  giverUserId: text("giver_user_id")
    .notNull()
    .references(() => users.id),
  recipientUserId: text("recipient_user_id")
    .notNull()
    .references(() => users.id),
  badgeDefinitionId: text("badge_definition_id")
    .notNull()
    .references(() => postBadgeDefinitions.id),
  coinAmount: integer("coin_amount").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type EarningStatus = "pending" | "eligible" | "paid";

export const monetizationEarnings = sqliteTable("monetization_earnings", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  postId: text("post_id")
    .notNull()
    .references(() => posts.id),
  badgeApplicationId: text("badge_application_id")
    .unique()
    .notNull()
    .references(() => postBadgeApplications.id),
  grossCoins: integer("gross_coins").notNull(),
  platformFeeCoins: integer("platform_fee_coins").notNull(),
  netCoins: integer("net_coins").notNull(),
  status: text("status").$type<EarningStatus>().notNull().default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type PayoutStatus = "pending" | "processing" | "completed" | "failed";

export const monetizationPayouts = sqliteTable("monetization_payouts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  coinsAmount: integer("coins_amount").notNull(),
  usdAmountCents: integer("usd_amount_cents").notNull(),
  status: text("status").$type<PayoutStatus>().notNull().default("pending"),
  provider: text("provider"),
  providerRef: text("provider_ref"),
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const adminMoneyLogs = sqliteTable("admin_money_logs", {
  id: text("id").primaryKey(),
  adminUserId: text("admin_user_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(),
  targetUserId: text("target_user_id"),
  amount: integer("amount"),
  refId: text("ref_id"),
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ─── Polls ───────────────────────────────────────────────────────────────────

export const polls = sqliteTable("polls", {
  id: text("id").primaryKey(),
  communityId: text("community_id")
    .notNull()
    .references(() => communities.id, { onDelete: "cascade" }),
  postId: text("post_id")
    .unique()
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  creatorId: text("creator_id")
    .notNull()
    .references(() => users.id),
  endsAt: integer("ends_at", { mode: "timestamp" }),
  isClosed: integer("is_closed", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const pollOptions = sqliteTable("poll_options", {
  id: text("id").primaryKey(),
  pollId: text("poll_id")
    .notNull()
    .references(() => polls.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  position: integer("position").notNull().default(0),
  voteCount: integer("vote_count").notNull().default(0),
});

export const pollVotes = sqliteTable("poll_votes", {
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  pollId: text("poll_id")
    .notNull()
    .references(() => polls.id, { onDelete: "cascade" }),
  optionId: text("option_id")
    .notNull()
    .references(() => pollOptions.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  // PK (userId, pollId) — set in migration
});

// ─── Giveaways ────────────────────────────────────────────────────────────────

export type GiveawayStatus = "active" | "ended" | "cancelled";

export const giveaways = sqliteTable("giveaways", {
  id: text("id").primaryKey(),
  communityId: text("community_id")
    .notNull()
    .references(() => communities.id, { onDelete: "cascade" }),
  postId: text("post_id").references(() => posts.id, { onDelete: "cascade" }),
  creatorId: text("creator_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  prize: text("prize").notNull(),
  status: text("status").$type<GiveawayStatus>().notNull().default("active"),
  endsAt: integer("ends_at", { mode: "timestamp" }),
  minMembershipDays: integer("min_membership_days"),
  minPostCount: integer("min_post_count"),
  winnerUserId: text("winner_user_id").references(() => users.id),
  winnerDrawnAt: integer("winner_drawn_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const giveawayEntries = sqliteTable("giveaway_entries", {
  id: text("id").primaryKey(),
  giveawayId: text("giveaway_id")
    .notNull()
    .references(() => giveaways.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  enteredAt: integer("entered_at", { mode: "timestamp" }).notNull(),
  // UNIQUE(giveawayId, userId) — set in migration
});

// ─── Pioneer Program ─────────────────────────────────────────────────────────

export const pioneerEnrollments = sqliteTable("pioneer_enrollments", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  communityId: text("community_id")
    .notNull()
    .references(() => communities.id, { onDelete: "cascade" }),
  enrolledByAdminId: text("enrolled_by_admin_id")
    .notNull()
    .references(() => users.id),
  contractRef: text("contract_ref"),
  enrolledAt: integer("enrolled_at", { mode: "timestamp" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

// ─── Pioneer Applications ─────────────────────────────────────────────────────

export type PioneerAppStatus = "pending" | "approved" | "rejected";

export const pioneerApplications = sqliteTable("pioneer_applications", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  coreHandle: text("core_handle"),
  twitchHandle: text("twitch_handle"),
  youtubeHandle: text("youtube_handle"),
  kickHandle: text("kick_handle"),
  twitchFollowers: integer("twitch_followers"),
  youtubeSubscribers: integer("youtube_subscribers"),
  kickFollowers: integer("kick_followers"),
  avgViewers: integer("avg_viewers"),
  communityName: text("community_name"),
  contentNiche: text("content_niche"),
  whyPioneer: text("why_pioneer").notNull(),
  sampleLinks: text("sample_links"),
  status: text("status").$type<PioneerAppStatus>().notNull().default("pending"),
  adminNote: text("admin_note"),
  reviewedByAdminId: text("reviewed_by_admin_id").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// ─── Feedback & Ban Appeals ────────────────────────────────────────────────────

export type FeedbackCategory = "bug" | "feature" | "support" | "other";
export type FeedbackStatus = "open" | "read" | "resolved";

export const feedback = sqliteTable("feedback", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  category: text("category").$type<FeedbackCategory>().notNull().default("other"),
  message: text("message").notNull(),
  status: text("status").$type<FeedbackStatus>().notNull().default("open"),
  adminNote: text("admin_note"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export type AppealStatus = "pending" | "approved" | "denied";

export const banAppeals = sqliteTable("ban_appeals", {
  id: text("id").primaryKey(),
  banId: text("ban_id")
    .notNull()
    .references(() => bans.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  communityId: text("community_id")
    .notNull()
    .references(() => communities.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  status: text("status").$type<AppealStatus>().notNull().default("pending"),
  reviewedByUserId: text("reviewed_by_user_id"),
  reviewNote: text("review_note"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// ─── Community Subscriptions (paid membership) ────────────────────────────────

export const communitySubscriptions = sqliteTable("community_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  communityId: text("community_id")
    .notNull()
    .references(() => communities.id, { onDelete: "cascade" }),
  status: text("status").$type<"active" | "cancelled">().notNull().default("active"),
  coinsPerWeek: integer("coins_per_week").notNull(),
  nextChargeAt: integer("next_charge_at", { mode: "timestamp" }).notNull(),
  cancelledAt: integer("cancelled_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | "community_post"
  | "mention"
  | "badge_received"
  | "post_comment"
  | "post_upvote"
  | "comment_reply"
  | "comment_like";

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").$type<NotificationType>().notNull(),
  actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
  communityId: text("community_id").references(() => communities.id, { onDelete: "cascade" }),
  postId: text("post_id").references(() => posts.id, { onDelete: "cascade" }),
  commentId: text("comment_id"),
  readAt: integer("read_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const communityNotificationPrefs = sqliteTable("community_notification_prefs", {
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  communityId: text("community_id")
    .notNull()
    .references(() => communities.id, { onDelete: "cascade" }),
  notifyNewPosts: integer("notify_new_posts", { mode: "boolean" }).notNull().default(false),
});

// ─── Wall Posts (personal profile feed) ──────────────────────────────────────

export const wallPosts = sqliteTable("wall_posts", {
  id: text("id").primaryKey(),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  body: text("body"),
  imageUrl: text("image_url"),
  score: integer("score").notNull().default(0),
  commentCount: integer("comment_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
