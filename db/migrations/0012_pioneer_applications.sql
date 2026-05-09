-- Pioneer programme: public application intake form
CREATE TABLE IF NOT EXISTS pioneer_applications (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  core_handle TEXT,
  twitch_handle TEXT,
  youtube_handle TEXT,
  kick_handle TEXT,
  twitch_followers INTEGER,
  youtube_subscribers INTEGER,
  kick_followers INTEGER,
  avg_viewers INTEGER,
  community_name TEXT,
  content_niche TEXT,
  why_pioneer TEXT NOT NULL,
  sample_links TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  reviewed_by_admin_id TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS pa_status_created ON pioneer_applications(status, created_at DESC);
