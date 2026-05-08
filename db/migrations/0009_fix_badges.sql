-- Fix badge double-up: remove mock-seed duplicates, rename canonicals to commissioned set.
-- The mock-seed inserted bd-001 through bd-007 with different IDs than the migration's pbd_* IDs.

-- Clean up mock-seed applications first (FK safety), then the definitions
DELETE FROM post_badge_applications WHERE badge_definition_id IN ('bd-001','bd-002','bd-003','bd-004','bd-005','bd-006','bd-007');
DELETE FROM post_badge_definitions WHERE id IN ('bd-001','bd-002','bd-003','bd-004','bd-005','bd-006','bd-007');

-- Also clean up any monetization_earnings rows pointing at the deleted applications (safe cascade)
DELETE FROM monetization_earnings WHERE badge_application_id NOT IN (SELECT id FROM post_badge_applications);

-- Rename canonical pbd_* badges to the commissioned set (keep IDs so existing FK refs stay valid)
UPDATE post_badge_definitions SET code='lurker',  name='Lurker',  icon='🔥', display_order=1, updated_at=unixepoch() WHERE id='pbd_lurker';
UPDATE post_badge_definitions SET code='hype',    name='Hype',    icon='🎉', display_order=2, updated_at=unixepoch() WHERE id='pbd_chatter';
UPDATE post_badge_definitions SET code='clipped', name='Clipped', icon='🎬', display_order=3, updated_at=unixepoch() WHERE id='pbd_clipper';
UPDATE post_badge_definitions SET code='w_post',  name='W Post',  icon='🏆', display_order=4, updated_at=unixepoch() WHERE id='pbd_hype';
UPDATE post_badge_definitions SET code='goated',  name='Goated',  icon='🐐', display_order=5, updated_at=unixepoch() WHERE id='pbd_supporter';
UPDATE post_badge_definitions SET code='viral',   name='Viral',   icon='⚡', display_order=6, updated_at=unixepoch() WHERE id='pbd_wave';
UPDATE post_badge_definitions SET code='legend',  name='Legend',  icon='✨', display_order=7, updated_at=unixepoch() WHERE id='pbd_king';
UPDATE post_badge_definitions SET code='core',    name='Core',    icon='💠', display_order=8, updated_at=unixepoch() WHERE id='pbd_core';
