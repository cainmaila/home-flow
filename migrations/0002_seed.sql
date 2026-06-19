-- 0002_seed.sql
-- Bootstrap: default household + first admin user.
-- Idempotent: INSERT OR IGNORE / INSERT OR REPLACE.

INSERT OR IGNORE INTO households (id, name) VALUES ('default', 'Home');

INSERT OR REPLACE INTO users (id, household_id, email, name, role)
VALUES ('cainmaila@gmail.com', 'default', 'cainmaila@gmail.com', 'cainmaila', 'admin');
