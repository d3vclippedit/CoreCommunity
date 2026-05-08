-- Users: platform ban flag + earning tier
ALTER TABLE users ADD COLUMN is_banned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN earning_tier TEXT NOT NULL DEFAULT 'none';

-- Posts: view counter
ALTER TABLE posts ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;

-- Pioneer Enrollments
CREATE TABLE IF NOT EXISTS pioneer_enrollments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  enrolled_by_admin_id TEXT NOT NULL REFERENCES users(id),
  contract_ref TEXT,
  enrolled_at INTEGER NOT NULL,
  expires_at INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_pioneer_enrollments_user ON pioneer_enrollments(user_id);

-- Feedback
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'other',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  admin_note TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);

-- Ban Appeals
CREATE TABLE IF NOT EXISTS ban_appeals (
  id TEXT PRIMARY KEY,
  ban_id TEXT NOT NULL REFERENCES bans(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by_user_id TEXT,
  review_note TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ban_appeals_status ON ban_appeals(status);
CREATE INDEX IF NOT EXISTS idx_ban_appeals_user ON ban_appeals(user_id);
