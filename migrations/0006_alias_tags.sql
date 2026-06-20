-- Cache AI-suggested tags per raw_category in category_aliases
ALTER TABLE category_aliases ADD COLUMN tags TEXT;
