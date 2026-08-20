ALTER TABLE "practice_attempts" ADD COLUMN "practice_set_version_id" uuid;
ALTER TABLE "practice_attempts" ADD COLUMN "revision" integer NOT NULL DEFAULT 0;
UPDATE "practice_attempts" SET "practice_set_version_id" = "practice_set_id" WHERE "practice_set_version_id" IS NULL;
ALTER TABLE "practice_attempts" ALTER COLUMN "practice_set_version_id" SET NOT NULL;
ALTER TABLE "practice_attempts" ADD CONSTRAINT "practice_attempts_set_version_fk" FOREIGN KEY ("practice_set_version_id") REFERENCES "practice_sets"("id");
ALTER TABLE "practice_attempts" ADD CONSTRAINT "practice_attempts_snapshot_check" CHECK ("practice_set_version_id" = "practice_set_id" AND "revision" >= 0);
CREATE OR REPLACE FUNCTION protect_practice_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.status = 'submitted' THEN RAISE EXCEPTION 'PRACTICE_ATTEMPT_IMMUTABLE'; END IF;
  IF NEW.learner_id <> OLD.learner_id OR NEW.practice_set_id <> OLD.practice_set_id OR NEW.practice_set_version_id <> OLD.practice_set_version_id OR NEW.revision < OLD.revision OR NEW.created_at <> OLD.created_at THEN RAISE EXCEPTION 'PRACTICE_ATTEMPT_SNAPSHOT_IMMUTABLE'; END IF;
  IF NEW.status = 'open' AND NEW.submitted_at IS NULL THEN RETURN NEW; END IF;
  IF NEW.status = 'submitted' AND OLD.status = 'open' AND NEW.submitted_at IS NOT NULL THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'PRACTICE_ATTEMPT_LIFECYCLE_INVALID';
END; $$;
