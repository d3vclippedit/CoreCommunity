-- 0010: polls, giveaways, TOTP 2FA, Twitch account linking

-- 2FA + Twitch columns on users
ALTER TABLE users ADD COLUMN totp_secret TEXT;
ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN twitch_id TEXT;
ALTER TABLE users ADD COLUMN twitch_username TEXT;
ALTER TABLE users ADD COLUMN twitch_linked_at INTEGER;
ALTER TABLE users ADD COLUMN twitch_url TEXT;

-- Polls attached to a post
CREATE TABLE IF NOT EXISTS polls (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  post_id TEXT UNIQUE NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES users(id),
  ends_at INTEGER,
  is_closed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS poll_options (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  vote_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS poll_votes (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id TEXT NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, poll_id)
);

-- Giveaways (standalone, not tied to a post)
CREATE TABLE IF NOT EXISTS giveaways (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  prize TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  ends_at INTEGER,
  min_membership_days INTEGER,
  min_post_count INTEGER,
  winner_user_id TEXT REFERENCES users(id),
  winner_drawn_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS giveaway_entries (
  id TEXT PRIMARY KEY,
  giveaway_id TEXT NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entered_at INTEGER NOT NULL,
  UNIQUE(giveaway_id, user_id)
);
