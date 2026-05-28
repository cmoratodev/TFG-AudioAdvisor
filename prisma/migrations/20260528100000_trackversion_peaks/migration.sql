-- Add a column to store pre-computed waveform peaks per version. The
-- frontend uses these to render the waveform without downloading the audio
-- file (SoundCloud-style).
ALTER TABLE "TrackVersion"
  ADD COLUMN "peaks" DOUBLE PRECISION[] NOT NULL DEFAULT '{}';
