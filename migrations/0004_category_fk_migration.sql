-- 0004_category_fk_migration.sql
-- Migrate TEXT-based category references to INTEGER FK → categories.id.
-- Affected tables: expenses, category_aliases, category_overrides, fixed_expense_rules.
-- Strategy: add category_id column, backfill from text → categories lookup, keep old text columns.

-- == expenses ==
ALTER TABLE expenses ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;

-- Backfill: match normalized_category text to child category name in same household
UPDATE expenses
SET category_id = (
  SELECT c.id FROM categories c
  WHERE c.household_id = expenses.household_id
    AND c.name = expenses.normalized_category
    AND c.parent_id IS NOT NULL
    AND c.is_deleted = 0
  LIMIT 1
)
WHERE normalized_category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(household_id, category_id);

-- == category_aliases ==
ALTER TABLE category_aliases ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;

UPDATE category_aliases
SET category_id = (
  SELECT c.id FROM categories c
  WHERE c.household_id = category_aliases.household_id
    AND c.name = category_aliases.normalized_category
    AND c.parent_id IS NOT NULL
    AND c.is_deleted = 0
  LIMIT 1
)
WHERE normalized_category IS NOT NULL;

-- == category_overrides ==
ALTER TABLE category_overrides ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;

UPDATE category_overrides
SET category_id = (
  SELECT c.id FROM categories c
  WHERE c.household_id = category_overrides.household_id
    AND c.name = category_overrides.new_value
    AND c.parent_id IS NOT NULL
    AND c.is_deleted = 0
  LIMIT 1
)
WHERE new_value IS NOT NULL;

-- == fixed_expense_rules ==
ALTER TABLE fixed_expense_rules ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;

UPDATE fixed_expense_rules
SET category_id = (
  SELECT c.id FROM categories c
  WHERE c.household_id = fixed_expense_rules.household_id
    AND c.name = fixed_expense_rules.normalized_category
    AND c.parent_id IS NOT NULL
    AND c.is_deleted = 0
  LIMIT 1
);

-- == ai_suggestions ==
ALTER TABLE ai_suggestions ADD COLUMN suggested_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;

UPDATE ai_suggestions
SET suggested_category_id = (
  SELECT c.id FROM categories c
  WHERE c.household_id = ai_suggestions.household_id
    AND c.name = ai_suggestions.suggested_category
    AND c.parent_id IS NOT NULL
    AND c.is_deleted = 0
  LIMIT 1
)
WHERE status != 'rejected';

-- Auto-reject orphaned pending suggestions (no matching category)
UPDATE ai_suggestions
SET status = 'rejected', resolved_at = datetime('now')
WHERE status = 'pending' AND suggested_category_id IS NULL;
