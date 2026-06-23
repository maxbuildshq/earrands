-- Distinguishes DJ/live music sets from non-musical programme items (workshops, talks, etc.)
-- so they can skip the artist-focused SetSheet and action buttons in the UI.
ALTER TABLE sets ADD COLUMN IF NOT EXISTS is_music_set boolean NOT NULL DEFAULT true;
