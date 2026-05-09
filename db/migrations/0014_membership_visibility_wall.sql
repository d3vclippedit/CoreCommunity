-- Community paid membership configuration
ALTER TABLE communities ADD COLUMN membership_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE communities ADD COLUMN membership_price_coins INTEGER NOT NULL DEFAULT 500;
ALTER TABLE communities ADD COLUMN membership_badge_icon TEXT NOT NULL DEFAULT '⭐';
ALTER TABLE communities ADD COLUMN membership_border_color TEXT NOT NULL DEFAULT '#F59E0B';

-- Members-only post visibility
ALTER TABLE posts ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public';

-- Paid community membership subscriptions
CREATE TABLE IF NOT EXISTS community_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  coins_per_week INTEGER NOT NULL,
  next_charge_at INTEGER NOT NULL,
  cancelled_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS cs_next_charge
  ON community_subscriptions(next_charge_at) WHERE status = 'active';

-- Personal profile wall posts
CREATE TABLE IF NOT EXISTS wall_posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT,
  image_url TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS wp_author ON wall_posts(author_id, created_at DESC);
