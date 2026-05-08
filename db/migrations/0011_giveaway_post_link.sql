-- Add post_id to giveaways so giveaways appear as posts in the community feed
ALTER TABLE giveaways ADD COLUMN post_id TEXT REFERENCES posts(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS giveaways_post_id_unique ON giveaways(post_id) WHERE post_id IS NOT NULL;
