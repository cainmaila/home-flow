CREATE TABLE IF NOT EXISTS installments (
  id             TEXT PRIMARY KEY,
  household_id   TEXT NOT NULL,
  total_amount   INTEGER NOT NULL,
  periods        INTEGER NOT NULL,
  start_month    TEXT NOT NULL,
  category_id    INTEGER REFERENCES categories(id),
  detail         TEXT,
  payment_method TEXT NOT NULL DEFAULT '現金',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE expenses ADD COLUMN installment_id TEXT;
CREATE INDEX IF NOT EXISTS idx_expenses_installment ON expenses(installment_id);
