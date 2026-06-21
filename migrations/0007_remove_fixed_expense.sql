-- Migrate is_fixed_expense=1 → "固定" tag

-- Ensure "固定" tag exists for each household with fixed expenses
INSERT OR IGNORE INTO tags (household_id, name)
SELECT DISTINCT household_id, '固定' FROM expenses WHERE is_fixed_expense = 1;

-- Link fixed expenses to the "固定" tag
INSERT OR IGNORE INTO expense_tags (expense_id, tag_id)
SELECT e.id, t.id
FROM expenses e
JOIN tags t ON t.household_id = e.household_id AND t.name = '固定'
WHERE e.is_fixed_expense = 1;

-- Drop the column
ALTER TABLE expenses DROP COLUMN is_fixed_expense;

-- Drop unused tables and indexes
DROP INDEX IF EXISTS idx_fixed_expense_overrides_expense;
DROP INDEX IF EXISTS idx_fixed_expense_rules_household;
DROP TABLE IF EXISTS fixed_expense_overrides;
DROP TABLE IF EXISTS fixed_expense_rules;
