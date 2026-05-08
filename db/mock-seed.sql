-- Mock seed: 5 communities, 20 users, posts, badge applications
PRAGMA foreign_keys = OFF;
-- Safe to run multiple times (INSERT OR IGNORE throughout)
-- Timestamps: unix seconds, approx March–May 2026

-- ── Badge definitions ────────────────────────────────────────────────────────
INSERT OR IGNORE INTO post_badge_definitions (id, code, name, icon, coin_cost, usd_value_cents, visibility_weight, is_active, display_order, created_at, updated_at) VALUES
  ('bd-001', 'lurker',   'Lurker',  '👻', 50,    50,    0.5,  1, 1, 1773360000, 1773360000),
  ('bd-002', 'hype',     'Hype',    '🔥', 100,   100,   1.0,  1, 2, 1773360000, 1773360000),
  ('bd-003', 'clip_it',  'Clip It', '🎬', 250,   250,   1.5,  1, 3, 1773360000, 1773360000),
  ('bd-004', 'w_post',   'W Post',  '🏆', 500,   500,   2.0,  1, 4, 1773360000, 1773360000),
  ('bd-005', 'goated',   'Goated',  '🐐', 1000,  1000,  3.0,  1, 5, 1773360000, 1773360000),
  ('bd-006', 'viral',    'Viral',   '💥', 2500,  2500,  5.0,  1, 6, 1773360000, 1773360000),
  ('bd-007', 'legend',   'Legend',  '⭐', 5000,  5000,  8.0,  1, 7, 1773360000, 1773360000),
  ('pbd_core', 'core',     'Core',    '💎', 10000, 10000, 15.0, 1, 8, 1773360000, 1773360000);

-- ── Mock users ───────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO users (id, email, handle, display_name, password_hash, email_verified_at, created_at, updated_at, is_platform_admin, is_verified_streamer) VALUES
  ('u-mock-01', 'clipking@mock.fake',     'clipking',     'ClipKing',     'MOCK_DISABLED', 1773360000, 1773360000, 1773360000, 0, 1),
  ('u-mock-02', 'xtremeplay@mock.fake',   'xtremeplay',   'XtremePlay',   'MOCK_DISABLED', 1773360000, 1773360000, 1773360000, 0, 0),
  ('u-mock-03', 'sniperz@mock.fake',      'sniperz',      'Sniperz',      'MOCK_DISABLED', 1773360000, 1773360000, 1773360000, 0, 0),
  ('u-mock-04', 'artieforge@mock.fake',   'artieforge',   'ArtieForge',   'MOCK_DISABLED', 1773360000, 1773360000, 1773360000, 0, 1),
  ('u-mock-05', 'pixelpainter@mock.fake', 'pixelpainter', 'PixelPainter', 'MOCK_DISABLED', 1773360000, 1773360000, 1773360000, 0, 0),
  ('u-mock-06', 'sketchlord@mock.fake',   'sketchlord',   'SketchLord',   'MOCK_DISABLED', 1773360000, 1773360000, 1773360000, 0, 0),
  ('u-mock-07', 'streamlord@mock.fake',   'streamlord',   'StreamLord',   'MOCK_DISABLED', 1773360000, 1773360000, 1773360000, 0, 1),
  ('u-mock-08', 'couchviewer@mock.fake',  'couchviewer',  'CouchViewer',  'MOCK_DISABLED', 1773360000, 1773360000, 1773360000, 0, 0),
  ('u-mock-09', 'lazystreamer@mock.fake', 'lazystreamer', 'LazyStreamer',  'MOCK_DISABLED', 1773360000, 1773360000, 1773360000, 0, 0),
  ('u-mock-10', 'memekinggg@mock.fake',   'memekinggg',   'MemeKinggg',   'MOCK_DISABLED', 1773360000, 1773360000, 1773360000, 0, 1),
  ('u-mock-11', 'dankposter@mock.fake',   'dankposter',   'DankPoster',   'MOCK_DISABLED', 1773360000, 1773360000, 1773360000, 0, 0),
  ('u-mock-12', 'trollface99@mock.fake',  'trollface99',  'Trollface99',  'MOCK_DISABLED', 1773360000, 1773360000, 1773360000, 0, 0),
  ('u-mock-13', 'techguru@mock.fake',     'techguru',     'TechGuru',     'MOCK_DISABLED', 1773360000, 1773360000, 1773360000, 0, 1),
  ('u-mock-14', 'linuxlover@mock.fake',   'linuxlover',   'LinuxLover',   'MOCK_DISABLED', 1773360000, 1773360000, 1773360000, 0, 0),
  ('u-mock-15', 'devbro@mock.fake',       'devbro',       'DevBro',       'MOCK_DISABLED', 1773360000, 1773360000, 1773360000, 0, 0),
  ('u-mock-16', 'casualfan@mock.fake',    'casualfan',    'CasualFan',    'MOCK_DISABLED', 1773360000, 1773360000, 1773360000, 0, 0),
  ('u-mock-17', 'nightowl@mock.fake',     'nightowl',     'NightOwl',     'MOCK_DISABLED', 1773360000, 1773360000, 1773360000, 0, 0),
  ('u-mock-18', 'hypetrain@mock.fake',    'hypetrain',    'HypeTrain',    'MOCK_DISABLED', 1773360000, 1773360000, 1773360000, 0, 0),
  ('u-mock-19', 'gigachad@mock.fake',     'gigachad',     'GigaChad',     'MOCK_DISABLED', 1773360000, 1773360000, 1773360000, 0, 0),
  ('u-mock-20', 'quietgamer@mock.fake',   'quietgamer',   'QuietGamer',   'MOCK_DISABLED', 1773360000, 1773360000, 1773360000, 0, 0);

-- ── Communities ──────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO communities (id, slug, name, tagline, description, accent_color, owner_id, is_verified, is_public, member_count, created_at, updated_at) VALUES
  ('c-mock-01', 'clip-hunters',  'Clip Hunters',  'The best gaming clips, ranked by the community.',            'Share your best plays, insane moments, and highlight reels.',  '#FF6B6B', 'u-mock-01', 1, 1, 7, 1773360000, 1773360000),
  ('c-mock-02', 'art-forge',     'Art Forge',     'Original digital art and creative showcases.',               'Post your art, get feedback, and celebrate creators.',          '#A78BFA', 'u-mock-04', 1, 1, 6, 1773360000, 1773360000),
  ('c-mock-03', 'stream-lounge', 'Stream Lounge', 'Chill talk for streamers and the people who watch them.',    'Discuss streaming life, share advice, and find new viewers.',   '#3DD68C', 'u-mock-07', 1, 1, 8, 1773360000, 1773360000),
  ('c-mock-04', 'meme-vault',    'Meme Vault',    'A vault of the internet''s finest memes. No cringe allowed.','Post your best memes. Community votes sort the vault.',          '#FB923C', 'u-mock-10', 0, 1, 9, 1773360000, 1773360000),
  ('c-mock-05', 'tech-talks',    'Tech Talks',    'Tech news, dev discussions, and hardware deep-dives.',       'From keyboard switches to kernel panics — all things tech.',    '#38BDF8', 'u-mock-13', 0, 1, 5, 1773360000, 1773360000);

-- ── Community sections ───────────────────────────────────────────────────────
INSERT OR IGNORE INTO community_sections (id, community_id, slug, name, position, post_permission, created_at) VALUES
  ('s-mock-01', 'c-mock-01', 'general', 'General',    0, 'anyone', 1773360000),
  ('s-mock-02', 'c-mock-01', 'clips',   'Clips',      1, 'anyone', 1773360000),
  ('s-mock-03', 'c-mock-02', 'general', 'General',    0, 'anyone', 1773360000),
  ('s-mock-04', 'c-mock-02', 'suggestions', 'Showcase', 1, 'anyone', 1773360000),
  ('s-mock-05', 'c-mock-03', 'general', 'General',    0, 'anyone', 1773360000),
  ('s-mock-06', 'c-mock-03', 'announcements', 'Announcements', 1, 'staff_only', 1773360000),
  ('s-mock-07', 'c-mock-04', 'general', 'General',    0, 'anyone', 1773360000),
  ('s-mock-08', 'c-mock-04', 'memes',   'Memes',      1, 'anyone', 1773360000),
  ('s-mock-09', 'c-mock-05', 'general', 'General',    0, 'anyone', 1773360000),
  ('s-mock-10', 'c-mock-05', 'questions', 'Questions', 1, 'anyone', 1773360000);

-- ── Community memberships ────────────────────────────────────────────────────
-- Clip Hunters (7 members)
INSERT OR IGNORE INTO community_memberships (user_id, community_id, role, joined_at, updated_at) VALUES
  ('u-mock-01', 'c-mock-01', 'streamer', 1773360000, 1773360000),
  ('u-mock-02', 'c-mock-01', 'member',   1773360000, 1773360000),
  ('u-mock-03', 'c-mock-01', 'member',   1773360000, 1773360000),
  ('u-mock-16', 'c-mock-01', 'member',   1773360000, 1773360000),
  ('u-mock-17', 'c-mock-01', 'member',   1773360000, 1773360000),
  ('u-mock-18', 'c-mock-01', 'member',   1773360000, 1773360000),
  ('u-mock-19', 'c-mock-01', 'member',   1773360000, 1773360000);

-- Art Forge (6 members)
INSERT OR IGNORE INTO community_memberships (user_id, community_id, role, joined_at, updated_at) VALUES
  ('u-mock-04', 'c-mock-02', 'streamer', 1773360000, 1773360000),
  ('u-mock-05', 'c-mock-02', 'member',   1773360000, 1773360000),
  ('u-mock-06', 'c-mock-02', 'member',   1773360000, 1773360000),
  ('u-mock-16', 'c-mock-02', 'member',   1773360000, 1773360000),
  ('u-mock-17', 'c-mock-02', 'member',   1773360000, 1773360000),
  ('u-mock-20', 'c-mock-02', 'member',   1773360000, 1773360000);

-- Stream Lounge (8 members)
INSERT OR IGNORE INTO community_memberships (user_id, community_id, role, joined_at, updated_at) VALUES
  ('u-mock-07', 'c-mock-03', 'streamer', 1773360000, 1773360000),
  ('u-mock-08', 'c-mock-03', 'member',   1773360000, 1773360000),
  ('u-mock-09', 'c-mock-03', 'member',   1773360000, 1773360000),
  ('u-mock-16', 'c-mock-03', 'member',   1773360000, 1773360000),
  ('u-mock-17', 'c-mock-03', 'member',   1773360000, 1773360000),
  ('u-mock-18', 'c-mock-03', 'member',   1773360000, 1773360000),
  ('u-mock-19', 'c-mock-03', 'member',   1773360000, 1773360000),
  ('u-mock-20', 'c-mock-03', 'member',   1773360000, 1773360000);

-- Meme Vault (9 members)
INSERT OR IGNORE INTO community_memberships (user_id, community_id, role, joined_at, updated_at) VALUES
  ('u-mock-10', 'c-mock-04', 'streamer', 1773360000, 1773360000),
  ('u-mock-11', 'c-mock-04', 'member',   1773360000, 1773360000),
  ('u-mock-12', 'c-mock-04', 'member',   1773360000, 1773360000),
  ('u-mock-16', 'c-mock-04', 'member',   1773360000, 1773360000),
  ('u-mock-17', 'c-mock-04', 'member',   1773360000, 1773360000),
  ('u-mock-18', 'c-mock-04', 'member',   1773360000, 1773360000),
  ('u-mock-19', 'c-mock-04', 'member',   1773360000, 1773360000),
  ('u-mock-20', 'c-mock-04', 'member',   1773360000, 1773360000),
  ('u-mock-02', 'c-mock-04', 'member',   1773360000, 1773360000);

-- Tech Talks (5 members)
INSERT OR IGNORE INTO community_memberships (user_id, community_id, role, joined_at, updated_at) VALUES
  ('u-mock-13', 'c-mock-05', 'streamer', 1773360000, 1773360000),
  ('u-mock-14', 'c-mock-05', 'member',   1773360000, 1773360000),
  ('u-mock-15', 'c-mock-05', 'member',   1773360000, 1773360000),
  ('u-mock-16', 'c-mock-05', 'member',   1773360000, 1773360000),
  ('u-mock-17', 'c-mock-05', 'member',   1773360000, 1773360000);

-- ── Posts ────────────────────────────────────────────────────────────────────
-- Clip Hunters posts (section: s-mock-01 general, s-mock-02 clips)
INSERT OR IGNORE INTO posts (id, community_id, section_id, author_id, type, title, body, score, upvotes, downvotes, comment_count, is_pinned, is_featured, created_at, updated_at) VALUES
  ('p-mock-001', 'c-mock-01', 's-mock-02', 'u-mock-01', 'text', 'Welcome to Clip Hunters — drop your best clips here!', 'This is the place for the most insane gaming moments. Post your clips, vote, and let the community decide what''s actually good.', 42, 44, 2, 5, 1, 0, 1773360000, 1773360000),
  ('p-mock-002', 'c-mock-01', 's-mock-02', 'u-mock-02', 'text', '360 no-scope into a 1v5 clutch — my hands were shaking', 'I literally screamed. My neighbours probably called the police. Worth it.', 87, 90, 3, 12, 0, 0, 1775779200, 1775779200),
  ('p-mock-003', 'c-mock-01', 's-mock-02', 'u-mock-03', 'text', 'Ranked up to Diamond with this one clip that carried', 'Three months of grinding and it all came down to this moment. Posted it on Twitter too but nobody cared there lol.', 61, 64, 3, 8, 0, 0, 1775779200, 1775779200),
  ('p-mock-004', 'c-mock-01', 's-mock-01', 'u-mock-16', 'text', 'What game are you all most likely to clip?', 'Curious what everyone''s grinding right now. I''m mainly on Valorant.', 28, 30, 2, 14, 0, 0, 1776988800, 1776988800),
  ('p-mock-005', 'c-mock-01', 's-mock-02', 'u-mock-18', 'text', 'This is why you never give up in OT', 'Down 3 players, 10 seconds left, somehow we won. The VOD doesn''t do it justice.', 54, 55, 1, 7, 0, 0, 1776988800, 1776988800),
  ('p-mock-006', 'c-mock-01', 's-mock-01', 'u-mock-19', 'text', 'Tips for making your clips look better without a capture card?', 'Running OBS but everything looks washed out. Anyone have settings they swear by?', 19, 21, 2, 9, 0, 0, 1777593600, 1777593600),
  ('p-mock-007', 'c-mock-01', 's-mock-02', 'u-mock-02', 'text', 'First time hitting Masters — the celebration clip is embarrassing but I''m proud', 'Screamed for about 30 seconds. Cat looked scared.', 103, 106, 3, 17, 0, 1, 1777593600, 1777593600),
  ('p-mock-008', 'c-mock-01', 's-mock-02', 'u-mock-03', 'text', 'Accidentally found a pixel-perfect wall boost that nobody knows about', 'I''ve been using it for 3 months. Posting this because it finally got patched.', 77, 79, 2, 11, 0, 0, 1778112000, 1778112000);

-- Art Forge posts (section: s-mock-03 general, s-mock-04 showcase)
INSERT OR IGNORE INTO posts (id, community_id, section_id, author_id, type, title, body, score, upvotes, downvotes, comment_count, is_pinned, is_featured, created_at, updated_at) VALUES
  ('p-mock-009', 'c-mock-02', 's-mock-04', 'u-mock-04', 'text', 'Welcome to Art Forge — show us what you''re making', 'All skill levels welcome. Post works-in-progress, finished pieces, sketches, anything. Be kind.', 38, 39, 1, 4, 1, 0, 1773360000, 1773360000),
  ('p-mock-010', 'c-mock-02', 's-mock-04', 'u-mock-05', 'text', 'Finished my first fully-rendered character piece — 40+ hours', 'Started as a quick sketch three weeks ago and somehow became this. Painted in Procreate.', 95, 97, 2, 13, 0, 1, 1775779200, 1775779200),
  ('p-mock-011', 'c-mock-02', 's-mock-04', 'u-mock-06', 'text', 'Study dump — 30 gesture drawings from this week', 'Trying to improve my anatomy. These are from 2-minute poses. Feedback welcome.', 46, 48, 2, 6, 0, 0, 1775779200, 1775779200),
  ('p-mock-012', 'c-mock-02', 's-mock-03', 'u-mock-16', 'text', 'Best free brushes for Krita?', 'Just switched from Photoshop and feeling lost. What brushes should I grab first?', 22, 24, 2, 10, 0, 0, 1776988800, 1776988800),
  ('p-mock-013', 'c-mock-02', 's-mock-04', 'u-mock-05', 'text', 'Environment concept I did for a jam — feedback appreciated', 'Tried to go for something between solarpunk and brutalist. Not sure it landed.', 67, 69, 2, 9, 0, 0, 1777593600, 1777593600),
  ('p-mock-014', 'c-mock-02', 's-mock-03', 'u-mock-17', 'text', 'How long did it take you to feel confident posting your art publicly?', 'Been drawing for 2 years and still feel weird sharing. Just want to know I''m not alone.', 58, 61, 3, 21, 0, 0, 1777593600, 1777593600),
  ('p-mock-015', 'c-mock-02', 's-mock-04', 'u-mock-06', 'text', 'Portrait commission I just wrapped — client was amazing to work with', 'Sharing with permission. Three rounds of revisions and it finally came together.', 81, 83, 2, 8, 0, 0, 1778112000, 1778112000),
  ('p-mock-016', 'c-mock-02', 's-mock-04', 'u-mock-20', 'text', 'Pixel art tileset I made for a game that never shipped', 'The game died but I still love this tileset. Releasing it free to use, credit appreciated.', 74, 76, 2, 15, 0, 0, 1778112000, 1778112000);

-- Stream Lounge posts (section: s-mock-05 general)
INSERT OR IGNORE INTO posts (id, community_id, section_id, author_id, type, title, body, score, upvotes, downvotes, comment_count, is_pinned, is_featured, created_at, updated_at) VALUES
  ('p-mock-017', 'c-mock-03', 's-mock-05', 'u-mock-07', 'text', 'Welcome to Stream Lounge — the chill place for streamers', 'Whether you have 3 viewers or 3000, you belong here. No gatekeeping.', 51, 52, 1, 6, 1, 0, 1773360000, 1773360000),
  ('p-mock-018', 'c-mock-03', 's-mock-05', 'u-mock-08', 'text', 'How to deal with slow growth without burning out?', 'Been streaming for 8 months and still averaging under 5 viewers. Starting to feel like I''m shouting into the void.', 89, 93, 4, 28, 0, 1, 1775779200, 1775779200),
  ('p-mock-019', 'c-mock-03', 's-mock-05', 'u-mock-09', 'text', 'Finally hit affiliate after 2 years of trying — my honest thoughts', 'It''s not what I expected. Here''s what I wish someone had told me earlier.', 112, 115, 3, 32, 0, 0, 1775779200, 1775779200),
  ('p-mock-020', 'c-mock-03', 's-mock-05', 'u-mock-17', 'text', 'What''s the one piece of gear that actually changed your stream quality?', 'I spent way too much on stuff that didn''t matter. What actually moved the needle for you?', 64, 67, 3, 19, 0, 0, 1776988800, 1776988800),
  ('p-mock-021', 'c-mock-03', 's-mock-05', 'u-mock-07', 'text', 'Scheduling streams: rigid calendar vs going live when you feel it?', 'I''ve tried both. Curious where people have landed.', 43, 44, 1, 16, 0, 0, 1776988800, 1776988800),
  ('p-mock-022', 'c-mock-03', 's-mock-05', 'u-mock-18', 'text', 'Viewer left a comment that genuinely made me tear up', 'They''ve been in my streams for over a year and I never knew how much it meant to them.', 97, 99, 2, 11, 0, 0, 1777593600, 1777593600),
  ('p-mock-023', 'c-mock-03', 's-mock-05', 'u-mock-08', 'text', 'Anyone else feel like Twitch discovery is completely broken right now?', 'I can''t find new streamers through the platform at all. Everything surfaces the same top channels.', 76, 80, 4, 24, 0, 0, 1777593600, 1777593600),
  ('p-mock-024', 'c-mock-03', 's-mock-05', 'u-mock-20', 'text', 'Took a 3-month break and came back to a warmer community than I left', 'Expected to restart from zero. Instead my regulars just... waited. Grateful doesn''t cover it.', 88, 90, 2, 14, 0, 0, 1778112000, 1778112000);

-- Meme Vault posts (section: s-mock-07 general, s-mock-08 memes)
INSERT OR IGNORE INTO posts (id, community_id, section_id, author_id, type, title, body, score, upvotes, downvotes, comment_count, is_pinned, is_featured, created_at, updated_at) VALUES
  ('p-mock-025', 'c-mock-04', 's-mock-08', 'u-mock-10', 'text', 'The vault is open — rules are simple: post good memes', 'Bad memes get downvoted. Great memes get badges. Do your worst.', 66, 67, 1, 3, 1, 0, 1773360000, 1773360000),
  ('p-mock-026', 'c-mock-04', 's-mock-08', 'u-mock-11', 'text', 'This meme format is going to age terribly and I love it', 'Peak 2026 humour. Archiving this for future generations.', 143, 147, 4, 22, 0, 1, 1775779200, 1775779200),
  ('p-mock-027', 'c-mock-04', 's-mock-08', 'u-mock-12', 'text', 'Rewatching old memes hits different when you know what came next', 'Found an old Vine compilation. Now I''m sad.', 57, 59, 2, 8, 0, 0, 1775779200, 1775779200),
  ('p-mock-028', 'c-mock-04', 's-mock-07', 'u-mock-19', 'text', 'What killed the original meme era?', 'I have a theory. It involves brand accounts discovering Twitter.', 48, 52, 4, 17, 0, 0, 1776988800, 1776988800),
  ('p-mock-029', 'c-mock-04', 's-mock-08', 'u-mock-11', 'text', 'The gaming meme pipeline from niche forums to mainstream in real time', 'Spotted something on a forum last Tuesday. It''s on Reddit''s front page today.', 91, 94, 3, 13, 0, 0, 1776988800, 1776988800),
  ('p-mock-030', 'c-mock-04', 's-mock-08', 'u-mock-02', 'text', 'Made a meme about patch day and the devs responded', 'I was not prepared for that interaction.', 178, 182, 4, 31, 0, 1, 1777593600, 1777593600),
  ('p-mock-031', 'c-mock-04', 's-mock-08', 'u-mock-12', 'text', 'This meme got me followed by someone with 400k followers and I have no idea why', 'It was just a low-effort shitpost. The internet is random.', 64, 66, 2, 9, 0, 0, 1777593600, 1777593600),
  ('p-mock-032', 'c-mock-04', 's-mock-08', 'u-mock-18', 'text', 'Ranking every major meme format from 2020 to now', 'Extremely scientific. Based entirely on vibes. Peer-reviewed by no one.', 85, 88, 3, 20, 0, 0, 1778112000, 1778112000);

-- Tech Talks posts (section: s-mock-09 general, s-mock-10 questions)
INSERT OR IGNORE INTO posts (id, community_id, section_id, author_id, type, title, body, score, upvotes, downvotes, comment_count, is_pinned, is_featured, created_at, updated_at) VALUES
  ('p-mock-033', 'c-mock-05', 's-mock-09', 'u-mock-13', 'text', 'Welcome to Tech Talks — everything from hardware to dev horror stories', 'Post your tech opinions, questions, setups, and finds. All levels welcome.', 29, 30, 1, 2, 1, 0, 1773360000, 1773360000),
  ('p-mock-034', 'c-mock-05', 's-mock-09', 'u-mock-14', 'text', 'I switched to Linux on my main machine — 6 month update', 'Spoiler: it''s mostly great but there''s one very specific thing that still annoys me.', 74, 77, 3, 19, 0, 0, 1775779200, 1775779200),
  ('p-mock-035', 'c-mock-05', 's-mock-10', 'u-mock-15', 'text', 'What''s the actual difference between ARM and x86 for everyday dev work?', 'I keep reading takes from both sides and they contradict each other. Help.', 53, 55, 2, 14, 0, 0, 1775779200, 1775779200),
  ('p-mock-036', 'c-mock-05', 's-mock-09', 'u-mock-16', 'text', 'This $40 keyboard switch feels better than my $200 keyboard', 'I hate that this is true. I am now going down a rabbit hole I cannot afford.', 88, 90, 2, 16, 0, 1, 1776988800, 1776988800),
  ('p-mock-037', 'c-mock-05', 's-mock-10', 'u-mock-17', 'text', 'How do you explain to non-tech people what you actually do all day?', 'My mum still thinks I "fix computers". I''m a backend engineer.', 66, 69, 3, 22, 0, 0, 1776988800, 1776988800),
  ('p-mock-038', 'c-mock-05', 's-mock-09', 'u-mock-14', 'text', 'Cloudflare Pages is genuinely impressive for side projects', 'Deployed three projects in a week with zero server config. The D1 + R2 combo is hard to beat at this price.', 71, 73, 2, 12, 0, 0, 1777593600, 1777593600),
  ('p-mock-039', 'c-mock-05', 's-mock-09', 'u-mock-13', 'text', 'AI-assisted coding: where it helps and where it actively makes things worse', 'Two years of daily use. Here are the patterns I''ve noticed.', 94, 97, 3, 27, 0, 0, 1777593600, 1777593600),
  ('p-mock-040', 'c-mock-05', 's-mock-10', 'u-mock-15', 'text', 'Is TypeScript strict mode actually worth the setup pain for solo projects?', 'I know the answer is probably yes. I just want validation.', 45, 47, 2, 11, 0, 0, 1778112000, 1778112000);

-- ── Post badge applications ───────────────────────────────────────────────────
-- Clip Hunters: 250+500+1000 = 1750 cc
INSERT OR IGNORE INTO post_badge_applications (id, post_id, community_id, giver_user_id, recipient_user_id, badge_definition_id, coin_amount, created_at) VALUES
  ('ba-001', 'p-mock-002', 'c-mock-01', 'u-mock-16', 'u-mock-02', 'bd-003', 250,  1775779200),
  ('ba-002', 'p-mock-007', 'c-mock-01', 'u-mock-18', 'u-mock-02', 'bd-004', 500,  1777593600),
  ('ba-003', 'p-mock-003', 'c-mock-01', 'u-mock-19', 'u-mock-03', 'bd-005', 1000, 1775779200);

-- Art Forge: 2500+500+1000 = 4000 cc
INSERT OR IGNORE INTO post_badge_applications (id, post_id, community_id, giver_user_id, recipient_user_id, badge_definition_id, coin_amount, created_at) VALUES
  ('ba-004', 'p-mock-010', 'c-mock-02', 'u-mock-04', 'u-mock-05', 'bd-006', 2500, 1775779200),
  ('ba-005', 'p-mock-015', 'c-mock-02', 'u-mock-17', 'u-mock-06', 'bd-004', 500,  1778112000),
  ('ba-006', 'p-mock-016', 'c-mock-02', 'u-mock-20', 'u-mock-20', 'bd-005', 1000, 1778112000);

-- Stream Lounge: 5000+1000+250 = 6250 cc
INSERT OR IGNORE INTO post_badge_applications (id, post_id, community_id, giver_user_id, recipient_user_id, badge_definition_id, coin_amount, created_at) VALUES
  ('ba-007', 'p-mock-019', 'c-mock-03', 'u-mock-08', 'u-mock-09', 'bd-007', 5000, 1775779200),
  ('ba-008', 'p-mock-018', 'c-mock-03', 'u-mock-07', 'u-mock-08', 'bd-005', 1000, 1775779200),
  ('ba-009', 'p-mock-022', 'c-mock-03', 'u-mock-17', 'u-mock-18', 'bd-003', 250,  1777593600);

-- Meme Vault: 10000+2500+500 = 13000 cc
INSERT OR IGNORE INTO post_badge_applications (id, post_id, community_id, giver_user_id, recipient_user_id, badge_definition_id, coin_amount, created_at) VALUES
  ('ba-010', 'p-mock-030', 'c-mock-04', 'u-mock-19', 'u-mock-02', 'pbd_core', 10000, 1777593600),
  ('ba-011', 'p-mock-026', 'c-mock-04', 'u-mock-12', 'u-mock-11', 'bd-006', 2500,  1775779200),
  ('ba-012', 'p-mock-029', 'c-mock-04', 'u-mock-18', 'u-mock-11', 'bd-004', 500,   1776988800);

-- Tech Talks: 1000+2500 = 3500 cc
INSERT OR IGNORE INTO post_badge_applications (id, post_id, community_id, giver_user_id, recipient_user_id, badge_definition_id, coin_amount, created_at) VALUES
  ('ba-013', 'p-mock-039', 'c-mock-05', 'u-mock-14', 'u-mock-13', 'bd-005', 1000, 1777593600),
  ('ba-014', 'p-mock-034', 'c-mock-05', 'u-mock-15', 'u-mock-14', 'bd-006', 2500, 1775779200);
