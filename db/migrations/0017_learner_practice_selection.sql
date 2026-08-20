ALTER TABLE "practice_sets" ADD COLUMN "title" text NOT NULL DEFAULT 'Practice set';
ALTER TABLE "practice_sets" ALTER COLUMN "title" DROP DEFAULT;
ALTER TABLE "practice_sets" ADD CONSTRAINT "practice_sets_title_check" CHECK ("title" = btrim("title") AND length("title") BETWEEN 1 AND 120);

CREATE TYPE "practice_attempt_status" AS ENUM ('open', 'submitted');
CREATE TYPE "practice_evidence_label" AS ENUM ('secure', 'building', 'needs_practice', 'not_assessed_yet');
CREATE TABLE "practice_attempts" (
  "id" uuid PRIMARY KEY NOT NULL,
  "learner_id" uuid NOT NULL REFERENCES "accounts"("id"),
  "practice_set_id" uuid NOT NULL REFERENCES "practice_sets"("id"),
  "status" "practice_attempt_status" NOT NULL DEFAULT 'open',
  "last_saved_at" timestamp with time zone NOT NULL DEFAULT now(),
  "submitted_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "practice_attempts_lifecycle_check" CHECK ((("status" = 'open' AND "submitted_at" IS NULL) OR ("status" = 'submitted' AND "submitted_at" IS NOT NULL)) AND "last_saved_at" >= "created_at" AND ("submitted_at" IS NULL OR "submitted_at" >= "created_at")),
  CONSTRAINT "practice_attempts_id_set_unique" UNIQUE("id", "practice_set_id")
);
CREATE INDEX "practice_attempts_learner_set_idx" ON "practice_attempts" ("learner_id", "practice_set_id", "status");
CREATE UNIQUE INDEX "practice_attempts_one_open_per_learner_set" ON "practice_attempts" ("learner_id", "practice_set_id") WHERE "status" = 'open';
CREATE TABLE "practice_attempt_evidence" (
  "id" uuid PRIMARY KEY NOT NULL,
  "attempt_id" uuid NOT NULL,
  "practice_set_id" uuid NOT NULL REFERENCES "practice_sets"("id"),
  "practice_area_id" text NOT NULL,
  "label" "practice_evidence_label" NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "practice_attempt_evidence_attempt_area_unique" UNIQUE("attempt_id", "practice_area_id"),
  CONSTRAINT "practice_attempt_evidence_attempt_set_fk" FOREIGN KEY("attempt_id", "practice_set_id") REFERENCES "practice_attempts"("id", "practice_set_id")
);
CREATE INDEX "practice_attempt_evidence_set_idx" ON "practice_attempt_evidence" ("practice_set_id");
CREATE TABLE "practice_recommendation_audits" (
  "id" uuid PRIMARY KEY NOT NULL,
  "learner_id" uuid NOT NULL REFERENCES "accounts"("id"),
  "version" text NOT NULL,
  "displayed_set_ids" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX "practice_recommendation_audits_learner_idx" ON "practice_recommendation_audits" ("learner_id");
CREATE OR REPLACE FUNCTION protect_practice_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.status = 'submitted' THEN RAISE EXCEPTION 'PRACTICE_ATTEMPT_IMMUTABLE'; END IF;
  IF NEW.status = 'open' AND NEW.learner_id = OLD.learner_id AND NEW.practice_set_id = OLD.practice_set_id AND NEW.created_at = OLD.created_at AND NEW.submitted_at IS NULL THEN RETURN NEW; END IF;
  IF NEW.status = 'submitted' AND OLD.status = 'open' AND NEW.learner_id = OLD.learner_id AND NEW.practice_set_id = OLD.practice_set_id AND NEW.created_at = OLD.created_at AND NEW.submitted_at IS NOT NULL THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'PRACTICE_ATTEMPT_LIFECYCLE_INVALID';
END; $$;
CREATE TRIGGER practice_attempts_lifecycle_guard BEFORE UPDATE OR DELETE ON "practice_attempts" FOR EACH ROW EXECUTE FUNCTION protect_practice_attempt();
CREATE OR REPLACE FUNCTION enforce_practice_attempt_evidence_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM practice_attempts WHERE id = NEW.attempt_id AND practice_set_id = NEW.practice_set_id AND status = 'submitted') THEN RAISE EXCEPTION 'PRACTICE_ATTEMPT_EVIDENCE_REQUIRES_SUBMITTED_ATTEMPT'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER practice_attempt_evidence_insert_guard BEFORE INSERT ON "practice_attempt_evidence" FOR EACH ROW EXECUTE FUNCTION enforce_practice_attempt_evidence_insert();
CREATE TRIGGER practice_attempt_evidence_immutable BEFORE UPDATE OR DELETE ON "practice_attempt_evidence" FOR EACH ROW EXECUTE FUNCTION prevent_practice_set_snapshot_mutation();
CREATE TRIGGER practice_recommendation_audits_immutable BEFORE UPDATE OR DELETE ON "practice_recommendation_audits" FOR EACH ROW EXECUTE FUNCTION prevent_practice_set_snapshot_mutation();
