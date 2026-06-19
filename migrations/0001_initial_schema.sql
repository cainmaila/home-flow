-- 0001_initial_schema.sql
-- Initial schema for Home Flow: 8 tables, all with household_id dimension.
-- D1 is SQLite-based. Money stored as INTEGER (cents). Dates as TEXT (ISO 8601).

CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL, -- FK households(id)
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'viewer')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_household ON users(household_id);

CREATE TABLE IF NOT EXISTS imports (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL, -- FK households(id)
  uploaded_by TEXT NOT NULL, -- FK users(id)
  filename TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('uploaded', 'previewed', 'committed', 'failed')),
  parsed_rows INTEGER NOT NULL DEFAULT 0,
  inserted_rows INTEGER NOT NULL DEFAULT 0,
  duplicate_rows INTEGER NOT NULL DEFAULT 0,
  updated_rows INTEGER NOT NULL DEFAULT 0,
  skipped_rows INTEGER NOT NULL DEFAULT 0,
  warning_rows INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  committed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_imports_household ON imports(household_id);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL, -- FK households(id)
  expense_date TEXT NOT NULL, -- ISO 8601 date
  raw_category TEXT NOT NULL,
  normalized_category TEXT,
  amount INTEGER NOT NULL, -- cents
  is_fixed_expense INTEGER NOT NULL DEFAULT 0, -- 0/1 boolean
  source_import_id TEXT, -- FK imports(id)
  override_flags TEXT, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_expenses_household ON expenses(household_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(household_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(household_id, normalized_category);
CREATE INDEX IF NOT EXISTS idx_expenses_import ON expenses(source_import_id);
-- Composite index for duplicate detection during import (Data-Rules §6)
CREATE INDEX IF NOT EXISTS idx_expenses_dedup ON expenses(household_id, expense_date, raw_category, amount);

CREATE TABLE IF NOT EXISTS category_aliases (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL, -- FK households(id)
  raw_category TEXT NOT NULL,
  normalized_category TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('manual', 'ai_auto')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (household_id, raw_category)
);

CREATE INDEX IF NOT EXISTS idx_category_aliases_household ON category_aliases(household_id);

CREATE TABLE IF NOT EXISTS category_overrides (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL, -- FK households(id)
  expense_id TEXT NOT NULL, -- FK expenses(id)
  field TEXT NOT NULL CHECK (field IN ('category')),
  old_value TEXT,
  new_value TEXT,
  created_by TEXT NOT NULL, -- FK users(id)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_category_overrides_expense ON category_overrides(expense_id);

CREATE TABLE IF NOT EXISTS fixed_expense_rules (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL, -- FK households(id)
  normalized_category TEXT NOT NULL,
  created_by TEXT NOT NULL, -- FK users(id)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (household_id, normalized_category)
);

CREATE INDEX IF NOT EXISTS idx_fixed_expense_rules_household ON fixed_expense_rules(household_id);

CREATE TABLE IF NOT EXISTS fixed_expense_overrides (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL, -- FK households(id)
  expense_id TEXT NOT NULL, -- FK expenses(id)
  is_fixed_expense INTEGER NOT NULL, -- 0/1 boolean
  created_by TEXT NOT NULL, -- FK users(id)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fixed_expense_overrides_expense ON fixed_expense_overrides(expense_id);

CREATE TABLE IF NOT EXISTS ai_suggestions (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL, -- FK households(id)
  import_id TEXT NOT NULL, -- FK imports(id)
  raw_category TEXT NOT NULL,
  suggested_category TEXT NOT NULL,
  confidence REAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_import ON ai_suggestions(import_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_household ON ai_suggestions(household_id);
