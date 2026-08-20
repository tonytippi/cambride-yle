ALTER TABLE "practice_attempts" ADD COLUMN "finalisation_key" uuid;
ALTER TABLE "practice_attempts" ADD CONSTRAINT "practice_attempts_finalisation_key_unique" UNIQUE("id", "finalisation_key");
ALTER TABLE "practice_attempts" ADD COLUMN "submitted_title" text;
ALTER TABLE "practice_attempts" ADD COLUMN "submitted_presentation" jsonb;
ALTER TABLE "practice_attempts" ADD COLUMN "expected_review_item_count" integer;
ALTER TABLE "practice_attempts" ADD COLUMN "review_snapshot_items" jsonb;
ALTER TABLE "practice_attempts" ADD COLUMN "final_timing" jsonb;
ALTER TABLE "practice_attempts" ADD COLUMN "playback_snapshot" jsonb;
CREATE TABLE "practice_attempt_review_items" (
  "id" uuid PRIMARY KEY NOT NULL,
  "attempt_id" uuid NOT NULL REFERENCES "practice_attempts"("id"),
  "practice_set_item_id" uuid NOT NULL REFERENCES "practice_set_items"("id"),
  "position" integer NOT NULL,
  "response" jsonb,
  "outcome" text NOT NULL CHECK ("outcome" IN ('correct', 'incorrect', 'unanswered', 'needs_teacher_review')),
  "evidence_label" "practice_evidence_label" NOT NULL,
  "approved_answer" jsonb NOT NULL,
  "explanation" text,
  "response_label" text,
  "approved_answer_label" text NOT NULL,
  "presentation" jsonb NOT NULL,
  "answer_policy_version" text NOT NULL,
  "curriculum_tags" jsonb NOT NULL,
  CONSTRAINT "practice_attempt_review_items_attempt_item_unique" UNIQUE("attempt_id", "practice_set_item_id")
);
CREATE INDEX "practice_attempt_review_items_attempt_idx" ON "practice_attempt_review_items" ("attempt_id");
CREATE OR REPLACE FUNCTION prevent_practice_attempt_review_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'PRACTICE_ATTEMPT_REVIEW_IMMUTABLE'; END; $$;
CREATE TRIGGER practice_attempt_review_items_immutable BEFORE UPDATE OR DELETE ON "practice_attempt_review_items" FOR EACH ROW EXECUTE FUNCTION prevent_practice_attempt_review_mutation();
CREATE OR REPLACE FUNCTION enforce_practice_attempt_review_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM practice_attempts a
    JOIN practice_set_items i ON i.practice_set_id = a.practice_set_version_id
    WHERE a.id = NEW.attempt_id AND a.status = 'submitted' AND a.finalisation_key IS NOT NULL AND a.expected_review_item_count IS NOT NULL AND a.review_snapshot_items IS NOT NULL
      AND i.id = NEW.practice_set_item_id AND i.position = NEW.position
  ) THEN RAISE EXCEPTION 'PRACTICE_ATTEMPT_REVIEW_SCOPE_INVALID'; END IF;
  IF (SELECT count(*) FROM practice_attempt_review_items WHERE attempt_id = NEW.attempt_id) >= (SELECT expected_review_item_count FROM practice_attempts WHERE id = NEW.attempt_id) THEN RAISE EXCEPTION 'PRACTICE_ATTEMPT_REVIEW_SNAPSHOT_COMPLETE'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER practice_attempt_review_items_scope_guard BEFORE INSERT ON "practice_attempt_review_items" FOR EACH ROW EXECUTE FUNCTION enforce_practice_attempt_review_insert();
CREATE OR REPLACE FUNCTION enforce_practice_attempt_review_snapshot_complete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected_count integer; expected_items jsonb; actual_items jsonb;
BEGIN
  IF NEW.status <> 'submitted' OR NEW.finalisation_key IS NULL THEN RETURN NEW; END IF;
  expected_count := NEW.expected_review_item_count;
  expected_items := NEW.review_snapshot_items;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', practice_set_item_id, 'position', position) ORDER BY position), '[]'::jsonb) INTO actual_items FROM practice_attempt_review_items WHERE attempt_id = NEW.id;
  IF expected_count IS NULL OR expected_items IS NULL OR jsonb_array_length(expected_items) <> expected_count OR jsonb_array_length(actual_items) <> expected_count OR actual_items <> expected_items THEN RAISE EXCEPTION 'PRACTICE_ATTEMPT_REVIEW_SNAPSHOT_INCOMPLETE'; END IF;
  RETURN NEW;
END; $$;
CREATE CONSTRAINT TRIGGER practice_attempts_review_snapshot_complete AFTER UPDATE OF status ON "practice_attempts" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_practice_attempt_review_snapshot_complete();
