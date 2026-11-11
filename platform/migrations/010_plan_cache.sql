-- Saved AI plans: the same request on the same screen returns the same plan (see assistant.ts, plan cache).
CREATE TABLE plan_cache (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, cache_key TEXT NOT NULL, instruction_key TEXT NOT NULL, plan TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (user_id, cache_key));
CREATE INDEX plan_cache_instruction ON plan_cache (user_id, instruction_key);
