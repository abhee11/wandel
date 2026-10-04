ALTER TABLE users ADD COLUMN clerk_id TEXT;
CREATE UNIQUE INDEX users_clerk ON users(clerk_id) WHERE clerk_id IS NOT NULL;
ALTER TABLE prototypes ADD COLUMN workflow_id TEXT;
CREATE UNIQUE INDEX prototypes_workflow ON prototypes(user_id,workflow_id) WHERE workflow_id IS NOT NULL;
CREATE TABLE workflow_saves (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, request_key TEXT NOT NULL, fingerprint TEXT NOT NULL, prototype_id TEXT NOT NULL REFERENCES prototypes(id) ON DELETE CASCADE, revision INTEGER NOT NULL, PRIMARY KEY(user_id,request_key));
CREATE TABLE stripe_events (id TEXT PRIMARY KEY, processed_at TEXT NOT NULL);
