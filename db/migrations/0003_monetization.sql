-- ── 0003_monetization.sql ─────────────────────────────────────────────────────
-- Core Coins, post badges, follower system, creator monetization

-- ── Extend existing tables ────────────────────────────────────────────────────
ALTER TABLE posts ADD COLUMN badge_score REAL NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN follower_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN following_count INTEGER NOT NULL DEFAULT 0;

-- Follows unique index (table exists as V2 stub from migration 0000)
CREATE UNIQUE INDEX IF NOT EXISTS idx_follows_unique ON follows(follower_id, followee_id);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id);

-- ── Coin bundles ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coin_bundles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  usd_price_cents INTEGER NOT NULL,
  coin_amount INTEGER NOT NULL,
  bonus_label TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- ── Coin wallets (one per user) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coin_wallets (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  total_purchased INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- ── Coin transactions (permanent ledger) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS coin_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  ref_type TEXT,
  ref_id TEXT,
  note TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_coin_tx_user ON coin_transactions(user_id, created_at DESC);

-- ── Payment orders (real money) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bundle_id TEXT NOT NULL REFERENCES coin_bundles(id),
  usd_amount_cents INTEGER NOT NULL,
  coin_amount INTEGER NOT NULL,
  provider TEXT NOT NULL,
  provider_order_id TEXT,
  provider_tx_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  ip_address TEXT,
  metadata TEXT,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON payment_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_provider_id ON payment_orders(provider_order_id);

-- ── Webhook events (idempotent — unique per provider+event_id) ────────────────
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  order_id TEXT,
  processed INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_unique ON payment_webhook_events(provider, event_id);

-- ── Post badge definitions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_badge_definitions (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  coin_cost INTEGER NOT NULL,
  usd_value_cents INTEGER NOT NULL,
  visibility_weight REAL NOT NULL DEFAULT 1.0,
  is_active INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- ── Post badge applications (permanent — every badge given is stored) ─────────
CREATE TABLE IF NOT EXISTS post_badge_applications (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  giver_user_id TEXT NOT NULL REFERENCES users(id),
  recipient_user_id TEXT NOT NULL REFERENCES users(id),
  badge_definition_id TEXT NOT NULL REFERENCES post_badge_definitions(id),
  coin_amount INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_post_badges_post ON post_badge_applications(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_badges_giver ON post_badge_applications(giver_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_badges_recipient ON post_badge_applications(recipient_user_id, created_at DESC);

-- ── Monetization earnings (server-side only, payout rate hidden from users) ───
CREATE TABLE IF NOT EXISTS monetization_earnings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  post_id TEXT NOT NULL REFERENCES posts(id),
  badge_application_id TEXT UNIQUE NOT NULL REFERENCES post_badge_applications(id),
  gross_coins INTEGER NOT NULL,
  platform_fee_coins INTEGER NOT NULL,
  net_coins INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_earnings_user ON monetization_earnings(user_id, status);

-- ── Monetization payouts ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monetization_payouts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  coins_amount INTEGER NOT NULL,
  usd_amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT,
  provider_ref TEXT,
  note TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payouts_user ON monetization_payouts(user_id, created_at DESC);

-- ── Admin money audit log ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_money_logs (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  target_user_id TEXT,
  amount INTEGER,
  ref_id TEXT,
  note TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_logs ON admin_money_logs(created_at DESC);

-- ── Seed: Coin bundles ────────────────────────────────────────────────────────
INSERT OR IGNORE INTO coin_bundles (id, name, usd_price_cents, coin_amount, bonus_label, is_active, display_order, created_at, updated_at) VALUES
  ('bundle_1', 'Starter',   249,   250,   NULL,         1, 1, unixepoch(), unixepoch()),
  ('bundle_2', 'Popular',   799,   825,   NULL,         1, 2, unixepoch(), unixepoch()),
  ('bundle_3', 'Value',     1499,  1625,  NULL,         1, 3, unixepoch(), unixepoch()),
  ('bundle_4', 'Super',     2499,  2700,  'Popular!',   1, 4, unixepoch(), unixepoch()),
  ('bundle_5', 'Mega',      4999,  5500,  'Best Value', 1, 5, unixepoch(), unixepoch()),
  ('bundle_6', 'Ultimate',  9999,  12000, NULL,         1, 6, unixepoch(), unixepoch()),
  ('bundle_7', 'Legendary', 24999, 30000, NULL,         1, 7, unixepoch(), unixepoch());

-- ── Seed: Post badge definitions ──────────────────────────────────────────────
INSERT OR IGNORE INTO post_badge_definitions (id, code, name, icon, coin_cost, usd_value_cents, visibility_weight, is_active, display_order, created_at, updated_at) VALUES
  ('pbd_lurker',    'lurker',             'Lurker',             '👀', 50,    50,    0.5,   1, 1, unixepoch(), unixepoch()),
  ('pbd_chatter',   'chatter',            'Chatter',            '💬', 100,   100,   1.0,   1, 2, unixepoch(), unixepoch()),
  ('pbd_clipper',   'clip_farmer',        'Clip Farmer',        '✂️', 250,   250,   2.5,   1, 3, unixepoch(), unixepoch()),
  ('pbd_hype',      'hype_train',         'Hype Train',         '🚂', 500,   500,   5.0,   1, 4, unixepoch(), unixepoch()),
  ('pbd_supporter', 'streamer_supporter', 'Streamer Supporter', '🎥', 1000,  1000,  10.0,  1, 5, unixepoch(), unixepoch()),
  ('pbd_wave',      'wave_leader',        'Wave Leader',        '🌊', 2500,  2500,  25.0,  1, 6, unixepoch(), unixepoch()),
  ('pbd_king',      'content_king',       'Content King',       '👑', 5000,  5000,  50.0,  1, 7, unixepoch(), unixepoch()),
  ('pbd_core',      'core',               'Core',               '🧿', 10000, 10000, 100.0, 1, 8, unixepoch(), unixepoch());
