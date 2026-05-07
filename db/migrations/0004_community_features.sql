-- ── 0004_community_features.sql ────────────────────────────────────────────────
-- Custom community backgrounds + custom member roles

-- ── Extend communities ────────────────────────────────────────────────────────
ALTER TABLE communities ADD COLUMN background_css TEXT;

-- ── Custom roles ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_custom_roles (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  base_role TEXT NOT NULL DEFAULT 'member',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_custom_roles_community ON community_custom_roles(community_id);

-- ── Assign custom roles to members ────────────────────────────────────────────
ALTER TABLE community_memberships ADD COLUMN custom_role_id TEXT REFERENCES community_custom_roles(id) ON DELETE SET NULL;
