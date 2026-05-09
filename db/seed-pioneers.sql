-- Pioneer test seed — run against local or remote D1:
--   Local:  wrangler d1 execute core-db --local --file=db/seed-pioneers.sql
--   Remote: wrangler d1 execute core-db --remote --file=db/seed-pioneers.sql

-- Fake pioneer streamer users
INSERT OR IGNORE INTO users (id, email, email_verified_at, handle, display_name, password_hash, created_at, updated_at, is_verified_streamer)
VALUES
  ('pioneer_u1', 'nightfall@test.dev', strftime('%s','now'), 'NightfallGG', 'NightfallGG', 'SEED_PLACEHOLDER', strftime('%s','now'), strftime('%s','now'), 1),
  ('pioneer_u2', 'frostbyte@test.dev', strftime('%s','now'), 'FrostByte', 'FrostByte', 'SEED_PLACEHOLDER', strftime('%s','now'), strftime('%s','now'), 1),
  ('pioneer_u3', 'apexraider@test.dev', strftime('%s','now'), 'ApexRaider', 'ApexRaider', 'SEED_PLACEHOLDER', strftime('%s','now'), strftime('%s','now'), 1);

-- Pioneer communities with membership enabled
INSERT OR IGNORE INTO communities (id, slug, name, tagline, owner_id, is_verified, is_public, member_count, membership_enabled, membership_price_coins, membership_badge_icon, membership_border_color, created_at, updated_at)
VALUES
  ('pioneer_c1', 'nightfall', 'Nightfall Gaming', 'Late night gaming, big plays', 'pioneer_u1', 1, 1, 1247, 1, 300, '*', '#6366F1', strftime('%s','now'), strftime('%s','now')),
  ('pioneer_c2', 'frostbyte', 'FrostByte Hub', 'Cold plays, hot takes', 'pioneer_u2', 1, 1, 892, 1, 500, '+', '#60A5FA', strftime('%s','now'), strftime('%s','now')),
  ('pioneer_c3', 'apexraiders', 'Apex Raiders', 'Ranked grind every day', 'pioneer_u3', 1, 1, 3104, 1, 750, '#', '#F59E0B', strftime('%s','now'), strftime('%s','now'));

-- Pioneer enrollments (self-referential admin for test data)
INSERT OR IGNORE INTO pioneer_enrollments (id, user_id, community_id, enrolled_by_admin_id, enrolled_at, is_active)
VALUES
  ('pe_1', 'pioneer_u1', 'pioneer_c1', 'pioneer_u1', strftime('%s','now'), 1),
  ('pe_2', 'pioneer_u2', 'pioneer_c2', 'pioneer_u2', strftime('%s','now'), 1),
  ('pe_3', 'pioneer_u3', 'pioneer_c3', 'pioneer_u3', strftime('%s','now'), 1);
