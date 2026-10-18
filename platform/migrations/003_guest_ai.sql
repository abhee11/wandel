CREATE TABLE guest_ai_actions (
 id TEXT PRIMARY KEY,
 guest_hash TEXT NOT NULL,
 ip_hash TEXT NOT NULL,
 request_key TEXT NOT NULL,
 fingerprint TEXT NOT NULL,
 day TEXT NOT NULL,
 status TEXT NOT NULL,
 result TEXT,
 UNIQUE(guest_hash, request_key)
);
CREATE INDEX guest_ai_day ON guest_ai_actions(day);
CREATE INDEX guest_ai_ip_day ON guest_ai_actions(ip_hash,day);
