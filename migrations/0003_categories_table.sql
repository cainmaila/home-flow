-- 0003_categories_table.sql
-- Category Redesign: two-level custom categories (parent + child).
-- Replaces hardcoded STANDARD_CATEGORIES with DB-driven categories.

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id TEXT NOT NULL,  -- FK households(id)
  name TEXT NOT NULL,
  description TEXT,            -- parent categories: scope hint for AI
  icon TEXT,
  color TEXT,
  parent_id INTEGER,           -- NULL = parent category; FK categories(id)
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0,  -- 0/1 boolean, soft delete
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (household_id, parent_id, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_household ON categories(household_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

-- Seed: 8 parent categories + 21 child categories for default household.
-- parent_id references are filled in a second pass using subqueries.

-- Parents (sort_order = display order)
INSERT OR IGNORE INTO categories (household_id, name, description, sort_order)
VALUES
  ('default', '食', '所有吃喝相關，含外食、食材採買、飲料零食', 1),
  ('default', '衣', '服飾、鞋包、配件等穿戴相關', 2),
  ('default', '住', '居住相關開銷，含水電瓦斯、日用消耗品', 3),
  ('default', '行', '日常通勤與大眾運輸', 4),
  ('default', '育', '教育、學習、書籍、課程', 5),
  ('default', '樂', '休閒娛樂、社交活動', 6),
  ('default', '醫療', '看診、藥品、健康檢查', 7),
  ('default', '汽車', '車輛相關費用，含油資、保養、停車', 8);

-- Children: 食
INSERT OR IGNORE INTO categories (household_id, name, parent_id, sort_order)
VALUES
  ('default', '早餐', (SELECT id FROM categories WHERE household_id='default' AND name='食' AND parent_id IS NULL), 1),
  ('default', '午餐', (SELECT id FROM categories WHERE household_id='default' AND name='食' AND parent_id IS NULL), 2),
  ('default', '晚餐', (SELECT id FROM categories WHERE household_id='default' AND name='食' AND parent_id IS NULL), 3),
  ('default', '飲料', (SELECT id FROM categories WHERE household_id='default' AND name='食' AND parent_id IS NULL), 4),
  ('default', '食材', (SELECT id FROM categories WHERE household_id='default' AND name='食' AND parent_id IS NULL), 5),
  ('default', '水果', (SELECT id FROM categories WHERE household_id='default' AND name='食' AND parent_id IS NULL), 6),
  ('default', '零食', (SELECT id FROM categories WHERE household_id='default' AND name='食' AND parent_id IS NULL), 7);

-- Children: 衣
INSERT OR IGNORE INTO categories (household_id, name, parent_id, sort_order)
VALUES
  ('default', '其他', (SELECT id FROM categories WHERE household_id='default' AND name='衣' AND parent_id IS NULL), 1);

-- Children: 住
INSERT OR IGNORE INTO categories (household_id, name, parent_id, sort_order)
VALUES
  ('default', '日用品', (SELECT id FROM categories WHERE household_id='default' AND name='住' AND parent_id IS NULL), 1),
  ('default', '瓦斯', (SELECT id FROM categories WHERE household_id='default' AND name='住' AND parent_id IS NULL), 2),
  ('default', '水', (SELECT id FROM categories WHERE household_id='default' AND name='住' AND parent_id IS NULL), 3),
  ('default', '電', (SELECT id FROM categories WHERE household_id='default' AND name='住' AND parent_id IS NULL), 4),
  ('default', '貸款', (SELECT id FROM categories WHERE household_id='default' AND name='住' AND parent_id IS NULL), 5);

-- Children: 行
INSERT OR IGNORE INTO categories (household_id, name, parent_id, sort_order)
VALUES
  ('default', '交通', (SELECT id FROM categories WHERE household_id='default' AND name='行' AND parent_id IS NULL), 1);

-- Children: 育
INSERT OR IGNORE INTO categories (household_id, name, parent_id, sort_order)
VALUES
  ('default', '其他', (SELECT id FROM categories WHERE household_id='default' AND name='育' AND parent_id IS NULL), 1);

-- Children: 樂
INSERT OR IGNORE INTO categories (household_id, name, parent_id, sort_order)
VALUES
  ('default', '外出', (SELECT id FROM categories WHERE household_id='default' AND name='樂' AND parent_id IS NULL), 1),
  ('default', '彩券', (SELECT id FROM categories WHERE household_id='default' AND name='樂' AND parent_id IS NULL), 2),
  ('default', '訂閱', (SELECT id FROM categories WHERE household_id='default' AND name='樂' AND parent_id IS NULL), 3);

-- Children: 醫療
INSERT OR IGNORE INTO categories (household_id, name, parent_id, sort_order)
VALUES
  ('default', '醫療', (SELECT id FROM categories WHERE household_id='default' AND name='醫療' AND parent_id IS NULL), 1),
  ('default', '保險', (SELECT id FROM categories WHERE household_id='default' AND name='醫療' AND parent_id IS NULL), 2);

-- Children: 汽車
INSERT OR IGNORE INTO categories (household_id, name, parent_id, sort_order)
VALUES
  ('default', '加油', (SELECT id FROM categories WHERE household_id='default' AND name='汽車' AND parent_id IS NULL), 1);
