CREATE TABLE access_codes (
 id TEXT PRIMARY KEY, code_hash TEXT NOT NULL UNIQUE, label TEXT NOT NULL,
 max_redemptions INTEGER NOT NULL CHECK(max_redemptions>0), grant_days INTEGER NOT NULL CHECK(grant_days BETWEEN 1 AND 365),
 expires_at TEXT NOT NULL, revoked_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE access_grants (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 code_id TEXT REFERENCES access_codes(id), source TEXT NOT NULL CHECK(source IN ('admin','beta_code')),
 expires_at TEXT, revoked_at TEXT, created_at TEXT NOT NULL,
 UNIQUE(user_id,code_id)
);
CREATE INDEX access_grants_user ON access_grants(user_id,expires_at);
