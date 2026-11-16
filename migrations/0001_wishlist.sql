-- The Wishlist app (worker/wishlist.ts).

CREATE TABLE wishlist_items (
  id          TEXT PRIMARY KEY,                -- a UUID
  name        TEXT NOT NULL,
  msrp_cents  INTEGER,                         -- list price; null = unknown
  expected_cents INTEGER,                      -- what he expects to pay; null = unknown
  notes       TEXT NOT NULL DEFAULT '',
  urls        TEXT NOT NULL DEFAULT '[]',      -- JSON: [{ "url": "https://…", "label": "Amazon" }]
  images      TEXT NOT NULL DEFAULT '[]',      -- JSON: ["<image id>", …]; the files live in R2
  position    INTEGER NOT NULL DEFAULT 0,      -- display order, lowest first
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

-- Who has bought what. Kept in its own table, and never touching wishlist_items, so that nothing about an
-- item (not even its updated_at) changes when it is bought. The Worker never sends this to Trent unless
-- he has pressed "Reveal purchases".
CREATE TABLE wishlist_claims (
  item_id    TEXT PRIMARY KEY REFERENCES wishlist_items(id) ON DELETE CASCADE,  -- one buyer per item
  name       TEXT NOT NULL,
  claimed_at INTEGER NOT NULL
);

CREATE TABLE wishlist_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
