-- 0005_detail_and_tags.sql
-- Add detail text field to expenses + normalized tags system (tags + expense_tags).

ALTER TABLE expenses ADD COLUMN detail TEXT;

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (household_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tags_household ON tags(household_id);

CREATE TABLE IF NOT EXISTS expense_tags (
  expense_id TEXT NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (expense_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_expense_tags_tag ON expense_tags(tag_id);
