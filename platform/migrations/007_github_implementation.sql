CREATE TABLE github_oauth_states (
 state_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 verifier TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE TABLE github_connections (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 login TEXT NOT NULL, token_cipher TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE TABLE implementation_jobs (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 request_key TEXT NOT NULL, fingerprint TEXT NOT NULL, data TEXT NOT NULL,
 UNIQUE(user_id, request_key)
);
ALTER TABLE implementation_jobs ADD COLUMN context_cipher TEXT NOT NULL DEFAULT '';
