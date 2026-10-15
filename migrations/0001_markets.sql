CREATE TABLE intervals (
  dataset TEXT NOT NULL, start INTEGER NOT NULL, end INTEGER NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload)), PRIMARY KEY(dataset, start)
);
CREATE INDEX interval_end ON intervals(end);
CREATE TABLE snapshots (
  id TEXT PRIMARY KEY, dataset TEXT NOT NULL, collected INTEGER NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload)), UNIQUE(dataset, collected)
);
CREATE INDEX snapshot_retention ON snapshots(collected);
CREATE TABLE checks (
  dataset TEXT PRIMARY KEY, provenance TEXT NOT NULL CHECK(json_valid(provenance)),
  issue TEXT, checked INTEGER NOT NULL
);
