-- One-shot DB reset: DROP all tables (incl. wrangler's d1_migrations tracker).
-- After running this, re-apply migrations from 0001.
-- Usage:
--   Local:  rm -rf .wrangler/state/v3/d1 && npx wrangler d1 migrations apply home-flow-db --local
--   Remote: npx wrangler d1 execute home-flow-db --remote --file scripts/reset-db.sql
--           npx wrangler d1 migrations apply home-flow-db --remote

DROP TABLE IF EXISTS ai_suggestions;
DROP TABLE IF EXISTS fixed_expense_overrides;
DROP TABLE IF EXISTS fixed_expense_rules;
DROP TABLE IF EXISTS category_overrides;
DROP TABLE IF EXISTS category_aliases;
DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS imports;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS households;
DROP TABLE IF EXISTS d1_migrations;
