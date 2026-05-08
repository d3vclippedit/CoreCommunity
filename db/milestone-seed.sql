-- Milestone demonstration seed
-- Adds badge applications to 4 posts to hit all four tier thresholds.
-- Safe to run once: uses INSERT OR IGNORE with unique IDs.
PRAGMA foreign_keys = OFF;

-- BRONZE (10k cc) ─ p-mock-030 "Made a meme about patch day" (Meme Vault)
--   Already has ba-010 worth 10,000 cc → sits exactly on the Bronze tier.

-- SILVER (25k cc) ─ p-mock-026 "This meme format is going to age terribly" (Meme Vault)
--   Currently: 2,500 cc (ba-011). Adding 22,500 → total 25,000 cc.
INSERT OR IGNORE INTO post_badge_applications
  (id, post_id, community_id, giver_user_id, recipient_user_id, badge_definition_id, coin_amount, created_at)
VALUES
  ('ba-ms-01', 'p-mock-026', 'c-mock-04', 'u-mock-19', 'u-mock-11', 'pbd_core', 22500, 1775779201);

-- GOLD (100k cc) ─ p-mock-019 "Finally hit affiliate after 2 years" (Stream Lounge)
--   Currently: 5,000 cc (ba-007). Adding 95,000 → total 100,000 cc.
INSERT OR IGNORE INTO post_badge_applications
  (id, post_id, community_id, giver_user_id, recipient_user_id, badge_definition_id, coin_amount, created_at)
VALUES
  ('ba-ms-02', 'p-mock-019', 'c-mock-03', 'u-mock-17', 'u-mock-09', 'pbd_core', 95000, 1775779202);

-- LEGENDARY (500k cc) ─ p-mock-007 "First time hitting Masters" (Clip Hunters)
--   Currently: 500 cc (ba-002). Adding 499,500 → total 500,000 cc.
INSERT OR IGNORE INTO post_badge_applications
  (id, post_id, community_id, giver_user_id, recipient_user_id, badge_definition_id, coin_amount, created_at)
VALUES
  ('ba-ms-03', 'p-mock-007', 'c-mock-01', 'u-mock-19', 'u-mock-02', 'pbd_core', 499500, 1775779203);
