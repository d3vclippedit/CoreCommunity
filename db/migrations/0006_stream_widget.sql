-- ── 0006_stream_widget.sql ──────────────────────────────────────────────────
-- Twitch channel for live stream/chat embed in community sidebar

ALTER TABLE communities ADD COLUMN twitch_channel TEXT;
