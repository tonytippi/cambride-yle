CREATE TABLE "practice_attempt_responses" (
  "id" uuid PRIMARY KEY NOT NULL,
  "attempt_id" uuid NOT NULL REFERENCES "practice_attempts"("id"),
  "practice_set_item_id" uuid NOT NULL REFERENCES "practice_set_items"("id"),
  "value" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "practice_attempt_responses_attempt_item_unique" UNIQUE("attempt_id", "practice_set_item_id")
);
CREATE INDEX "practice_attempt_responses_attempt_idx" ON "practice_attempt_responses" ("attempt_id");
CREATE TABLE "practice_attempt_playback_events" (
  "id" uuid PRIMARY KEY NOT NULL,
  "attempt_id" uuid NOT NULL REFERENCES "practice_attempts"("id"),
  "practice_set_item_id" uuid NOT NULL REFERENCES "practice_set_items"("id"),
  "practice_set_item_media_id" uuid NOT NULL REFERENCES "practice_set_item_media"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX "practice_attempt_playback_events_attempt_idx" ON "practice_attempt_playback_events" ("attempt_id");
CREATE OR REPLACE FUNCTION enforce_practice_attempt_response_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM practice_attempts a JOIN practice_set_items i ON i.practice_set_id = a.practice_set_version_id WHERE a.id = NEW.attempt_id AND a.status = 'open' AND i.id = NEW.practice_set_item_id) THEN RAISE EXCEPTION 'PRACTICE_ATTEMPT_RESPONSE_SCOPE_INVALID'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER practice_attempt_responses_scope_guard BEFORE INSERT OR UPDATE ON "practice_attempt_responses" FOR EACH ROW EXECUTE FUNCTION enforce_practice_attempt_response_scope();
CREATE OR REPLACE FUNCTION enforce_practice_attempt_response_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM practice_attempts a JOIN practice_set_items i ON i.practice_set_id = a.practice_set_version_id WHERE a.id = OLD.attempt_id AND a.status = 'open' AND i.id = OLD.practice_set_item_id) THEN RAISE EXCEPTION 'PRACTICE_ATTEMPT_RESPONSE_SCOPE_INVALID'; END IF;
  RETURN OLD;
END; $$;
CREATE TRIGGER practice_attempt_responses_delete_guard BEFORE DELETE ON "practice_attempt_responses" FOR EACH ROW EXECUTE FUNCTION enforce_practice_attempt_response_delete();
CREATE OR REPLACE FUNCTION enforce_practice_attempt_playback_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM practice_attempts a JOIN practice_set_items i ON i.practice_set_id = a.practice_set_version_id JOIN practice_set_item_media m ON m.practice_set_item_id = i.id WHERE a.id = NEW.attempt_id AND a.status = 'open' AND i.id = NEW.practice_set_item_id AND m.id = NEW.practice_set_item_media_id AND m.media_type = 'audio') THEN RAISE EXCEPTION 'PRACTICE_ATTEMPT_PLAYBACK_SCOPE_INVALID'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER practice_attempt_playback_events_scope_guard BEFORE INSERT ON "practice_attempt_playback_events" FOR EACH ROW EXECUTE FUNCTION enforce_practice_attempt_playback_scope();
CREATE TRIGGER practice_attempt_playback_events_immutable BEFORE UPDATE OR DELETE ON "practice_attempt_playback_events" FOR EACH ROW EXECUTE FUNCTION prevent_practice_set_snapshot_mutation();
