-- Auto-enable membership for all communities owned by active pioneers
UPDATE communities
SET membership_enabled = 1
WHERE owner_id IN (
  SELECT user_id FROM pioneer_enrollments WHERE is_active = 1
);
