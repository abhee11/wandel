CREATE TABLE workflow_links (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE, name TEXT NOT NULL, record TEXT NOT NULL,
 created_at TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE INDEX workflow_links_owner ON workflow_links(user_id,expires_at);
