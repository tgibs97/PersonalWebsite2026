-- The Paper Toss leaderboard (worker/arcade.ts).

-- High scores: one board per difficulty, ranked by score (a longer streak is better), earlier first on a tie.
CREATE TABLE arcade_scores (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  mode        TEXT NOT NULL,                -- baby | souls
  initials    TEXT NOT NULL,                -- exactly three letters or digits
  score       INTEGER NOT NULL,             -- the streak
  achieved_at INTEGER NOT NULL,
  visitor     TEXT,                         -- the long-lived visitor id, to stop one browser filling a board
  user_id     TEXT                          -- guests | family | trent
);
CREATE INDEX arcade_scores_rank ON arcade_scores (mode, score DESC, achieved_at);

-- Runs whose score has already been handed in, so a signed run token can only be used once.
CREATE TABLE arcade_runs (
  id      TEXT PRIMARY KEY,
  used_at INTEGER NOT NULL
);
