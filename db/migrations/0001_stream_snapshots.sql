CREATE TABLE `stream_snapshots` (
  `id` TEXT PRIMARY KEY,
  `streamer_login` TEXT NOT NULL,
  `viewer_count` INTEGER NOT NULL DEFAULT 0,
  `is_live` INTEGER NOT NULL DEFAULT 0,
  `stream_title` TEXT,
  `game_name` TEXT,
  `recorded_at` INTEGER NOT NULL
);

CREATE INDEX `idx_snap_login_time` ON `stream_snapshots` (`streamer_login`, `recorded_at` DESC);
CREATE INDEX `idx_snap_time` ON `stream_snapshots` (`recorded_at` DESC);
