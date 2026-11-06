CREATE TABLE public_views (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 workflow TEXT NOT NULL,
 html TEXT NOT NULL,
 masked INTEGER NOT NULL,
 created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL
);
CREATE INDEX public_views_user ON public_views(user_id,created_at);
CREATE INDEX public_views_expiry ON public_views(expires_at);
