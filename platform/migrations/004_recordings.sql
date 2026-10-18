CREATE TABLE recordings (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 data BLOB NOT NULL,
 bytes INTEGER NOT NULL CHECK(bytes>0 AND bytes<=20971520),
 created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL
);
CREATE INDEX recordings_owner ON recordings(user_id,created_at);
CREATE INDEX recordings_expiry ON recordings(expires_at);
