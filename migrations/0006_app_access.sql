-- Per-user app switches (worker/controls.ts), replacing the one-switch-per-app table from 0005.
-- A (app, user) pair with no row is on, so a fresh database changes nothing.
CREATE TABLE app_access (
  app_id     TEXT NOT NULL,
  user_id    TEXT NOT NULL,       -- guests | family | trent
  enabled    INTEGER NOT NULL,    -- 1 on, 0 off
  changed_at INTEGER NOT NULL,
  PRIMARY KEY (app_id, user_id)
);

-- Anything switched off before applied to Guests and Family & Friends (Trent always saw everything).
INSERT INTO app_access (app_id, user_id, enabled, changed_at)
  SELECT s.app_id, u.id, 0, s.changed_at
  FROM app_switches s, (SELECT 'guests' AS id UNION ALL SELECT 'family') u
  WHERE s.enabled = 0;

DROP TABLE app_switches;
