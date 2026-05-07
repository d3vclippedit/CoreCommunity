-- Seed D3V founder / platform-admin account.
-- password_hash sentinel: login sets the real hash on first use (d3v only).
INSERT INTO users (
  id,
  email,
  email_verified_at,
  handle,
  display_name,
  password_hash,
  avatar_url,
  bio,
  created_at,
  updated_at,
  is_platform_admin,
  is_verified_streamer,
  xp,
  level,
  reputation
) VALUES (
  'd3000000-0000-4000-8000-000000000001',
  'ollieolzo@gmail.com',
  cast(strftime('%s', 'now') as integer),
  'd3v',
  'D3V',
  '__founder_unset__',
  NULL,
  NULL,
  cast(strftime('%s', 'now') as integer),
  cast(strftime('%s', 'now') as integer),
  1,
  1,
  0,
  0,
  0
);
