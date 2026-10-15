-- Keep reporter-facing replies separate from private administrator notes.
ALTER TABLE problem_reports ADD COLUMN IF NOT EXISTS user_note TEXT;
