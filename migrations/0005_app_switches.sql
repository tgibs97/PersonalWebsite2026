-- Which apps Trent has switched off for everyone else (worker/controls.ts). An app with no row is on.
CREATE TABLE app_switches (
  app_id     TEXT PRIMARY KEY,
  enabled    INTEGER NOT NULL,     -- 1 on, 0 off
  changed_at INTEGER NOT NULL
);
