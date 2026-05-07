-- ── 0005_role_permissions.sql ──────────────────────────────────────────────────
-- Granular content permissions on custom roles + community member defaults

-- ── Community member defaults ─────────────────────────────────────────────────
-- Controls what plain members (no custom role) can do.
ALTER TABLE communities ADD COLUMN member_can_post_links INTEGER NOT NULL DEFAULT 1;
ALTER TABLE communities ADD COLUMN member_can_post_images INTEGER NOT NULL DEFAULT 1;
ALTER TABLE communities ADD COLUMN member_can_post_videos INTEGER NOT NULL DEFAULT 1;
-- NULL = use system default (10/hr), 0 = no limit
ALTER TABLE communities ADD COLUMN member_posts_per_hour INTEGER;

-- ── Custom role content permissions ──────────────────────────────────────────
-- These override the community member defaults for members with this role.
ALTER TABLE community_custom_roles ADD COLUMN can_post_links INTEGER NOT NULL DEFAULT 1;
ALTER TABLE community_custom_roles ADD COLUMN can_post_images INTEGER NOT NULL DEFAULT 1;
ALTER TABLE community_custom_roles ADD COLUMN can_post_videos INTEGER NOT NULL DEFAULT 1;
-- NULL = use community member default, 0 = no limit
ALTER TABLE community_custom_roles ADD COLUMN posts_per_hour INTEGER;
