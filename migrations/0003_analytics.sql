-- Site analytics (worker/analytics.ts). Raw rows are deleted after 365 days.

-- One row per login session: who, from where, on what.
CREATE TABLE an_visits (
  id         TEXT PRIMARY KEY,              -- derived from the session cookie
  visitor    TEXT NOT NULL,                 -- the long-lived visitor id (a cookie), to spot repeat visitors
  user_id    TEXT NOT NULL,                 -- guests | family
  started_at INTEGER NOT NULL,
  last_at    INTEGER NOT NULL,
  events     INTEGER NOT NULL DEFAULT 0,
  ip         TEXT,
  country    TEXT,
  region     TEXT,
  city       TEXT,
  asn        INTEGER,
  org        TEXT,                          -- the network, e.g. "Comcast" or "DigitalOcean"
  ua         TEXT,                          -- the raw browser string
  browser    TEXT,
  os         TEXT,
  device     TEXT
);
CREATE INDEX an_visits_visitor ON an_visits (visitor, started_at);
CREATE INDEX an_visits_started ON an_visits (started_at);
CREATE INDEX an_visits_ip      ON an_visits (ip);

-- What they did: open an app, close it (with seconds), follow a link, finish a game, view a photo...
CREATE TABLE an_events (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  visit_id TEXT NOT NULL,
  at       INTEGER NOT NULL,
  kind     TEXT NOT NULL,
  target   TEXT,
  detail   TEXT
);
CREATE INDEX an_events_visit ON an_events (visit_id, at);
CREATE INDEX an_events_at    ON an_events (at);

-- Log-on attempts worth remembering one by one: successes, and wrong passwords.
CREATE TABLE an_logins (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  at      INTEGER NOT NULL,
  visitor TEXT,
  user_id TEXT,
  outcome TEXT NOT NULL,                    -- guest_ok | pw_ok | pw_wrong
  ip      TEXT,
  country TEXT,
  ua      TEXT
);
CREATE INDEX an_logins_at ON an_logins (at);
CREATE INDEX an_logins_ip ON an_logins (ip);

-- Daily totals for traffic that is too plentiful to keep row by row (bots hit the log-on page all day).
CREATE TABLE an_counters (
  day TEXT NOT NULL,                        -- YYYY-MM-DD, UTC
  key TEXT NOT NULL,                        -- login_page | bot_passed | bot_failed | desktop
  n   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, key)
);
