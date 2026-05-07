-- ── 0007_role_colors.sql ────────────────────────────────────────────────────
-- Customisable badge colours for each staff tier in a community

ALTER TABLE communities ADD COLUMN role_color_streamer TEXT;
ALTER TABLE communities ADD COLUMN role_color_admin TEXT;
ALTER TABLE communities ADD COLUMN role_color_senior_mod TEXT;
ALTER TABLE communities ADD COLUMN role_color_mod TEXT;
