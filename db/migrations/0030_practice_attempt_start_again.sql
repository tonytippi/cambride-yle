-- Start again retains the replaced open attempt as an immutable abandoned record; submitted attempts are untouched.
-- Status comparisons use text so the new enum value is not cast inside the migration transaction.
ALTER TYPE "practice_attempt_status" ADD VALUE IF NOT EXISTS 'abandoned';
--> statement-breakpoint
ALTER TABLE "practice_attempts" ADD COLUMN "abandoned_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "practice_attempts" DROP CONSTRAINT "practice_attempts_lifecycle_check";
--> statement-breakpoint
ALTER TABLE "practice_attempts" ADD CONSTRAINT "practice_attempts_lifecycle_check" CHECK (((("status"::text = 'open' OR "status"::text = 'abandoned') AND "submitted_at" IS NULL) OR ("status"::text = 'submitted' AND "submitted_at" IS NOT NULL)) AND (("status"::text = 'abandoned') = ("abandoned_at" IS NOT NULL)) AND "last_saved_at" >= "created_at" AND ("submitted_at" IS NULL OR "submitted_at" >= "created_at") AND ("abandoned_at" IS NULL OR "abandoned_at" >= "created_at"));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_practice_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.status::text IN ('submitted', 'abandoned') THEN RAISE EXCEPTION 'PRACTICE_ATTEMPT_IMMUTABLE'; END IF;
  IF NEW.learner_id <> OLD.learner_id OR NEW.practice_set_id <> OLD.practice_set_id OR NEW.practice_set_version_id <> OLD.practice_set_version_id OR NEW.revision < OLD.revision OR NEW.created_at <> OLD.created_at THEN RAISE EXCEPTION 'PRACTICE_ATTEMPT_SNAPSHOT_IMMUTABLE'; END IF;
  IF NEW.status::text = 'open' AND NEW.submitted_at IS NULL AND NEW.abandoned_at IS NULL THEN RETURN NEW; END IF;
  IF NEW.status::text = 'submitted' AND NEW.submitted_at IS NOT NULL AND NEW.abandoned_at IS NULL THEN RETURN NEW; END IF;
  IF NEW.status::text = 'abandoned' AND NEW.submitted_at IS NULL AND NEW.abandoned_at IS NOT NULL AND NEW.revision = OLD.revision THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'PRACTICE_ATTEMPT_LIFECYCLE_INVALID';
END; $$;
