CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address_key TEXT NOT NULL,
  address_display TEXT NOT NULL,
  listed_price TEXT NOT NULL,
  listed_price_num INTEGER,
  beds TEXT DEFAULT '',
  baths TEXT DEFAULT '',
  sqft TEXT DEFAULT '',
  listing_url TEXT DEFAULT '',
  site TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'public',
  room_hash TEXT NOT NULL DEFAULT '',
  handle TEXT NOT NULL,
  rating INTEGER,
  fair_value INTEGER,
  tags TEXT NOT NULL DEFAULT '[]',
  comment TEXT NOT NULL,
  agrees INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comments_lookup
  ON comments(address_key, scope, room_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_recent
  ON comments(scope, room_hash, created_at DESC);
