-- One chat message may take several AI calls (plan, inspect, repair, review); they share a turn and count as one action.
ALTER TABLE ai_actions ADD COLUMN turn_id TEXT;
CREATE INDEX ai_actions_turn ON ai_actions(user_id,turn_id);
