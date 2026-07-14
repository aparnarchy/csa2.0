-- AI insight cache (Phase 5.1): one row per dashboard scope + time window.
-- `fingerprint` captures the aggregate numbers that produced `text`, so the
-- LLM is only called again when the underlying scores actually change.
CREATE TABLE aiInsights (
  id TEXT PRIMARY KEY,          -- e.g. 'team-mgr:<managerId>|3M', 'ceo:org|3M'
  fingerprint TEXT NOT NULL,
  text TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
