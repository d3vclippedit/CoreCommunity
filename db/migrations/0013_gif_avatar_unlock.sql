-- Unlock animated GIF avatars for users who spend $50+ on Core Coins
ALTER TABLE users ADD COLUMN gif_avatar_unlocked INTEGER NOT NULL DEFAULT 0;
