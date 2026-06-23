-- 付款方式清單
CREATE TABLE IF NOT EXISTS payment_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (household_id, name)
);

INSERT OR IGNORE INTO payment_methods (household_id, name, sort_order) VALUES
  ('default', '現金', 0),
  ('default', '中信', 1),
  ('default', '台新', 2),
  ('default', '玉山', 3);

-- 每筆支出的付款方式
ALTER TABLE expenses ADD COLUMN payment_method TEXT NOT NULL DEFAULT '現金';
