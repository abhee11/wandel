-- Teams: people who share what Wandel learns about their apps. Invites go by email and are accepted by signing in with that email.
CREATE TABLE teams (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL);
CREATE TABLE team_members (team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK(role IN ('owner','member')), joined_at TEXT NOT NULL, PRIMARY KEY(team_id,user_id));
CREATE INDEX team_members_user ON team_members(user_id);
CREATE TABLE team_invites (token_hash TEXT PRIMARY KEY, team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE, email TEXT NOT NULL, invited_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, accepted_at TEXT);
CREATE INDEX team_invites_team ON team_invites(team_id,email);
