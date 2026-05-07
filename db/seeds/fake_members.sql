-- Seed fake members for "The Community" (testcommunity)
-- community_id: 63406bf9-455f-4b23-b1fc-1f359f06329c
-- owner (d3v) id: d3000000-0000-4000-8000-000000000001

-- ── Ensure d3v has a membership row as streamer ───────────────────────────────
INSERT OR IGNORE INTO community_memberships (user_id, community_id, role, joined_at, updated_at)
VALUES (
  'd3000000-0000-4000-8000-000000000001',
  '63406bf9-455f-4b23-b1fc-1f359f06329c',
  'streamer',
  1700000000,
  1700000000
);

-- ── 1 Admin ───────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO users (id, email, handle, display_name, password_hash, created_at, updated_at)
VALUES
  ('seed-admin-0001', 'admin1@example.com', 'adminone', 'Alex Admin', 'x', 1700000100, 1700000100);

INSERT OR IGNORE INTO community_memberships (user_id, community_id, role, joined_at, updated_at)
VALUES ('seed-admin-0001', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'admin', 1700000100, 1700000100);

-- ── 3 Senior Mods ─────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO users (id, email, handle, display_name, password_hash, created_at, updated_at)
VALUES
  ('seed-smod-0001', 'smod1@example.com', 'seniorsam',   'Senior Sam',   'x', 1700000200, 1700000200),
  ('seed-smod-0002', 'smod2@example.com', 'seniortaylor','Senior Taylor', 'x', 1700000201, 1700000201),
  ('seed-smod-0003', 'smod3@example.com', 'seniorjordan','Senior Jordan', 'x', 1700000202, 1700000202);

INSERT OR IGNORE INTO community_memberships (user_id, community_id, role, joined_at, updated_at)
VALUES
  ('seed-smod-0001', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'senior_mod', 1700000200, 1700000200),
  ('seed-smod-0002', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'senior_mod', 1700000201, 1700000201),
  ('seed-smod-0003', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'senior_mod', 1700000202, 1700000202);

-- ── 5 Mods ────────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO users (id, email, handle, display_name, password_hash, created_at, updated_at)
VALUES
  ('seed-mod-00001', 'mod1@example.com', 'modriley',   'Mod Riley',   'x', 1700000300, 1700000300),
  ('seed-mod-00002', 'mod2@example.com', 'modmorgan',  'Mod Morgan',  'x', 1700000301, 1700000301),
  ('seed-mod-00003', 'mod3@example.com', 'modcasey',   'Mod Casey',   'x', 1700000302, 1700000302),
  ('seed-mod-00004', 'mod4@example.com', 'modjamie',   'Mod Jamie',   'x', 1700000303, 1700000303),
  ('seed-mod-00005', 'mod5@example.com', 'modquinn',   'Mod Quinn',   'x', 1700000304, 1700000304);

INSERT OR IGNORE INTO community_memberships (user_id, community_id, role, joined_at, updated_at)
VALUES
  ('seed-mod-00001', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'mod', 1700000300, 1700000300),
  ('seed-mod-00002', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'mod', 1700000301, 1700000301),
  ('seed-mod-00003', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'mod', 1700000302, 1700000302),
  ('seed-mod-00004', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'mod', 1700000303, 1700000303),
  ('seed-mod-00005', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'mod', 1700000304, 1700000304);

-- ── 47 Regular Members ────────────────────────────────────────────────────────
INSERT OR IGNORE INTO users (id, email, handle, display_name, password_hash, created_at, updated_at)
VALUES
  ('seed-mem-00001', 'm001@example.com', 'viewer_aurora',   'Aurora',      'x', 1700001000, 1700001000),
  ('seed-mem-00002', 'm002@example.com', 'viewer_blake',    'Blake',       'x', 1700001001, 1700001001),
  ('seed-mem-00003', 'm003@example.com', 'viewer_cam',      'Cam',         'x', 1700001002, 1700001002),
  ('seed-mem-00004', 'm004@example.com', 'viewer_dakota',   'Dakota',      'x', 1700001003, 1700001003),
  ('seed-mem-00005', 'm005@example.com', 'viewer_emery',    'Emery',       'x', 1700001004, 1700001004),
  ('seed-mem-00006', 'm006@example.com', 'viewer_finley',   'Finley',      'x', 1700001005, 1700001005),
  ('seed-mem-00007', 'm007@example.com', 'viewer_gray',     'Gray',        'x', 1700001006, 1700001006),
  ('seed-mem-00008', 'm008@example.com', 'viewer_harper',   'Harper',      'x', 1700001007, 1700001007),
  ('seed-mem-00009', 'm009@example.com', 'viewer_indigo',   'Indigo',      'x', 1700001008, 1700001008),
  ('seed-mem-00010', 'm010@example.com', 'viewer_jules',    'Jules',       'x', 1700001009, 1700001009),
  ('seed-mem-00011', 'm011@example.com', 'viewer_kendall',  'Kendall',     'x', 1700001010, 1700001010),
  ('seed-mem-00012', 'm012@example.com', 'viewer_lane',     'Lane',        'x', 1700001011, 1700001011),
  ('seed-mem-00013', 'm013@example.com', 'viewer_morgan2',  'Morgan',      'x', 1700001012, 1700001012),
  ('seed-mem-00014', 'm014@example.com', 'viewer_nova',     'Nova',        'x', 1700001013, 1700001013),
  ('seed-mem-00015', 'm015@example.com', 'viewer_onyx',     'Onyx',        'x', 1700001014, 1700001014),
  ('seed-mem-00016', 'm016@example.com', 'viewer_paige',    'Paige',       'x', 1700001015, 1700001015),
  ('seed-mem-00017', 'm017@example.com', 'viewer_quinn2',   'Quinn',       'x', 1700001016, 1700001016),
  ('seed-mem-00018', 'm018@example.com', 'viewer_reese',    'Reese',       'x', 1700001017, 1700001017),
  ('seed-mem-00019', 'm019@example.com', 'viewer_sage',     'Sage',        'x', 1700001018, 1700001018),
  ('seed-mem-00020', 'm020@example.com', 'viewer_tatum',    'Tatum',       'x', 1700001019, 1700001019),
  ('seed-mem-00021', 'm021@example.com', 'viewer_unity',    'Unity',       'x', 1700001020, 1700001020),
  ('seed-mem-00022', 'm022@example.com', 'viewer_vale',     'Vale',        'x', 1700001021, 1700001021),
  ('seed-mem-00023', 'm023@example.com', 'viewer_wren',     'Wren',        'x', 1700001022, 1700001022),
  ('seed-mem-00024', 'm024@example.com', 'viewer_xander',   'Xander',      'x', 1700001023, 1700001023),
  ('seed-mem-00025', 'm025@example.com', 'viewer_yara',     'Yara',        'x', 1700001024, 1700001024),
  ('seed-mem-00026', 'm026@example.com', 'viewer_zephyr',   'Zephyr',      'x', 1700001025, 1700001025),
  ('seed-mem-00027', 'm027@example.com', 'viewer_ash',      'Ash',         'x', 1700001026, 1700001026),
  ('seed-mem-00028', 'm028@example.com', 'viewer_bay',      'Bay',         'x', 1700001027, 1700001027),
  ('seed-mem-00029', 'm029@example.com', 'viewer_cedar',    'Cedar',       'x', 1700001028, 1700001028),
  ('seed-mem-00030', 'm030@example.com', 'viewer_drift',    'Drift',       'x', 1700001029, 1700001029),
  ('seed-mem-00031', 'm031@example.com', 'viewer_echo2',    'Echo',        'x', 1700001030, 1700001030),
  ('seed-mem-00032', 'm032@example.com', 'viewer_flint',    'Flint',       'x', 1700001031, 1700001031),
  ('seed-mem-00033', 'm033@example.com', 'viewer_glen',     'Glen',        'x', 1700001032, 1700001032),
  ('seed-mem-00034', 'm034@example.com', 'viewer_haven',    'Haven',       'x', 1700001033, 1700001033),
  ('seed-mem-00035', 'm035@example.com', 'viewer_isle',     'Isle',        'x', 1700001034, 1700001034),
  ('seed-mem-00036', 'm036@example.com', 'viewer_jet',      'Jet',         'x', 1700001035, 1700001035),
  ('seed-mem-00037', 'm037@example.com', 'viewer_koda',     'Koda',        'x', 1700001036, 1700001036),
  ('seed-mem-00038', 'm038@example.com', 'viewer_lark',     'Lark',        'x', 1700001037, 1700001037),
  ('seed-mem-00039', 'm039@example.com', 'viewer_mist',     'Mist',        'x', 1700001038, 1700001038),
  ('seed-mem-00040', 'm040@example.com', 'viewer_nile',     'Nile',        'x', 1700001039, 1700001039),
  ('seed-mem-00041', 'm041@example.com', 'viewer_orion2',   'Orion',       'x', 1700001040, 1700001040),
  ('seed-mem-00042', 'm042@example.com', 'viewer_pike',     'Pike',        'x', 1700001041, 1700001041),
  ('seed-mem-00043', 'm043@example.com', 'viewer_river',    'River',       'x', 1700001042, 1700001042),
  ('seed-mem-00044', 'm044@example.com', 'viewer_storm',    'Storm',       'x', 1700001043, 1700001043),
  ('seed-mem-00045', 'm045@example.com', 'viewer_tide',     'Tide',        'x', 1700001044, 1700001044),
  ('seed-mem-00046', 'm046@example.com', 'viewer_uplift',   'Uplift',      'x', 1700001045, 1700001045),
  ('seed-mem-00047', 'm047@example.com', 'viewer_vox',      'Vox',         'x', 1700001046, 1700001046);

INSERT OR IGNORE INTO community_memberships (user_id, community_id, role, joined_at, updated_at)
VALUES
  ('seed-mem-00001', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001000, 1700001000),
  ('seed-mem-00002', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001001, 1700001001),
  ('seed-mem-00003', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001002, 1700001002),
  ('seed-mem-00004', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001003, 1700001003),
  ('seed-mem-00005', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001004, 1700001004),
  ('seed-mem-00006', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001005, 1700001005),
  ('seed-mem-00007', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001006, 1700001006),
  ('seed-mem-00008', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001007, 1700001007),
  ('seed-mem-00009', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001008, 1700001008),
  ('seed-mem-00010', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001009, 1700001009),
  ('seed-mem-00011', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001010, 1700001010),
  ('seed-mem-00012', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001011, 1700001011),
  ('seed-mem-00013', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001012, 1700001012),
  ('seed-mem-00014', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001013, 1700001013),
  ('seed-mem-00015', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001014, 1700001014),
  ('seed-mem-00016', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001015, 1700001015),
  ('seed-mem-00017', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001016, 1700001016),
  ('seed-mem-00018', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001017, 1700001017),
  ('seed-mem-00019', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001018, 1700001018),
  ('seed-mem-00020', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001019, 1700001019),
  ('seed-mem-00021', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001020, 1700001020),
  ('seed-mem-00022', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001021, 1700001021),
  ('seed-mem-00023', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001022, 1700001022),
  ('seed-mem-00024', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001023, 1700001023),
  ('seed-mem-00025', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001024, 1700001024),
  ('seed-mem-00026', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001025, 1700001025),
  ('seed-mem-00027', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001026, 1700001026),
  ('seed-mem-00028', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001027, 1700001027),
  ('seed-mem-00029', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001028, 1700001028),
  ('seed-mem-00030', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001029, 1700001029),
  ('seed-mem-00031', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001030, 1700001030),
  ('seed-mem-00032', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001031, 1700001031),
  ('seed-mem-00033', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001032, 1700001032),
  ('seed-mem-00034', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001033, 1700001033),
  ('seed-mem-00035', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001034, 1700001034),
  ('seed-mem-00036', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001035, 1700001035),
  ('seed-mem-00037', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001036, 1700001036),
  ('seed-mem-00038', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001037, 1700001037),
  ('seed-mem-00039', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001038, 1700001038),
  ('seed-mem-00040', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001039, 1700001039),
  ('seed-mem-00041', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001040, 1700001040),
  ('seed-mem-00042', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001041, 1700001041),
  ('seed-mem-00043', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001042, 1700001042),
  ('seed-mem-00044', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001043, 1700001043),
  ('seed-mem-00045', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001044, 1700001044),
  ('seed-mem-00046', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001045, 1700001045),
  ('seed-mem-00047', '63406bf9-455f-4b23-b1fc-1f359f06329c', 'member', 1700001046, 1700001046);

-- ── Update member_count ────────────────────────────────────────────────────────
-- d3v(1) + admin(1) + senior_mods(3) + mods(5) + members(47) = 57
UPDATE communities
SET member_count = 57
WHERE id = '63406bf9-455f-4b23-b1fc-1f359f06329c';
