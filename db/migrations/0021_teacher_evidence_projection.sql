ALTER TABLE "audit_events" ADD COLUMN "outcome" text;
ALTER TABLE "audit_events" ADD COLUMN "target_scope" text;
ALTER TABLE "practice_attempts" ADD CONSTRAINT "practice_attempts_id_learner_set_unique" UNIQUE("id", "learner_id", "practice_set_id");
ALTER TABLE "practice_attempt_review_items" ADD CONSTRAINT "practice_attempt_review_items_id_attempt_unique" UNIQUE("id", "attempt_id");
CREATE TYPE "evidence_outcome" AS ENUM ('correct', 'incorrect', 'unanswered', 'needs_teacher_review');
CREATE TABLE "submitted_evidence_facts" (
  "id" uuid PRIMARY KEY NOT NULL,
  "attempt_id" uuid NOT NULL,
  "review_item_id" uuid NOT NULL,
  "learner_id" uuid NOT NULL,
  "practice_set_id" uuid NOT NULL REFERENCES "practice_sets"("id"),
  "paper" text NOT NULL CHECK ("paper" IN ('listening', 'reading_writing')),
  "part" text NOT NULL,
  "language_target_id" uuid NOT NULL REFERENCES "curriculum_targets"("id"),
  "language_target" text NOT NULL,
  "automatic_outcome" "evidence_outcome" NOT NULL,
  "submitted_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "submitted_evidence_facts_review_target_unique" UNIQUE("review_item_id", "language_target_id"),
  CONSTRAINT "submitted_evidence_facts_attempt_scope_fk" FOREIGN KEY ("attempt_id", "learner_id", "practice_set_id") REFERENCES "practice_attempts"("id", "learner_id", "practice_set_id"),
  CONSTRAINT "submitted_evidence_facts_review_attempt_fk" FOREIGN KEY ("review_item_id", "attempt_id") REFERENCES "practice_attempt_review_items"("id", "attempt_id")
);
CREATE INDEX "submitted_evidence_facts_latest_idx" ON "submitted_evidence_facts" ("learner_id", "practice_set_id", "submitted_at", "attempt_id");
CREATE INDEX "submitted_evidence_facts_target_idx" ON "submitted_evidence_facts" ("paper", "part", "language_target_id", "submitted_at");
CREATE OR REPLACE FUNCTION prevent_submitted_evidence_fact_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'SUBMITTED_EVIDENCE_FACT_IMMUTABLE'; END; $$;
CREATE TRIGGER submitted_evidence_facts_immutable BEFORE UPDATE OR DELETE ON "submitted_evidence_facts" FOR EACH ROW EXECUTE FUNCTION prevent_submitted_evidence_fact_mutation();
CREATE OR REPLACE FUNCTION enforce_submitted_evidence_fact_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM practice_attempts a
    JOIN practice_attempt_review_items r ON r.id = NEW.review_item_id AND r.attempt_id = a.id
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(r.curriculum_tags -> 'evidenceTargets') = 'array'
        THEN r.curriculum_tags -> 'evidenceTargets'
        ELSE '[]'::jsonb
      END
    ) AS target(value)
    WHERE a.id = NEW.attempt_id
      AND a.learner_id = NEW.learner_id
      AND a.practice_set_id = NEW.practice_set_id
      AND a.status = 'submitted'
      AND a.submitted_presentation ->> 'paper' = NEW.paper
      AND a.submitted_presentation ->> 'part' = NEW.part
      AND r.outcome::text = NEW.automatic_outcome::text
      AND (target.value ->> 'id') = NEW.language_target_id::text
      AND (target.value ->> 'label') = NEW.language_target
  ) THEN
    RAISE EXCEPTION 'SUBMITTED_EVIDENCE_FACT_SCOPE_INVALID';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER submitted_evidence_facts_scope_guard BEFORE INSERT ON "submitted_evidence_facts" FOR EACH ROW EXECUTE FUNCTION enforce_submitted_evidence_fact_insert();
-- Historical facts are inserted only when the immutable review snapshot already contains
-- an explicit target ID and label tuple. Missing target dimensions are deliberately skipped.
INSERT INTO "submitted_evidence_facts" ("id", "attempt_id", "review_item_id", "learner_id", "practice_set_id", "paper", "part", "language_target_id", "language_target", "automatic_outcome", "submitted_at")
SELECT (substring(md5(a.id::text || r.id::text || ((target.value::jsonb) ->> 'id')) FROM 1 FOR 8) || '-' || substring(md5(a.id::text || r.id::text || ((target.value::jsonb) ->> 'id')) FROM 9 FOR 4) || '-7' || substring(md5(a.id::text || r.id::text || ((target.value::jsonb) ->> 'id')) FROM 14 FOR 3) || '-8' || substring(md5(a.id::text || r.id::text || ((target.value::jsonb) ->> 'id')) FROM 18 FOR 3) || '-' || substring(md5(a.id::text || r.id::text || ((target.value::jsonb) ->> 'id')) FROM 21 FOR 12))::uuid, a.id, r.id, a.learner_id, a.practice_set_id,
  a.submitted_presentation ->> 'paper', a.submitted_presentation ->> 'part',
  ((target.value::jsonb) ->> 'id')::uuid, (target.value::jsonb) ->> 'label', r.outcome::"evidence_outcome", a.submitted_at
FROM "practice_attempts" a
JOIN "practice_attempt_review_items" r ON r.attempt_id = a.id
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.curriculum_tags -> 'evidenceTargets', '[]'::jsonb)) AS target(value)
JOIN "curriculum_targets" ct ON ct.id::text = ((target.value::jsonb) ->> 'id')
WHERE a.status = 'submitted'
  AND a.submitted_at IS NOT NULL
  AND a.submitted_presentation ->> 'paper' IN ('listening', 'reading_writing')
  AND a.submitted_presentation ->> 'part' IS NOT NULL
  AND (target.value::jsonb) ? 'id'
  AND (target.value::jsonb) ? 'label'
  AND ((target.value::jsonb) ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
ON CONFLICT ("review_item_id", "language_target_id") DO NOTHING;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_evidence_read_outcome_check" CHECK (
  ("action" <> 'EVIDENCE_READ' AND "outcome" IS NULL AND "target_scope" IS NULL)
  OR (
    "action" = 'EVIDENCE_READ'
    AND "actor_id" IS NOT NULL
    AND "outcome" IN ('SUCCESS', 'NO_DATA')
    AND (
      ("target_scope" = 'CENTRE_WIDE' AND "target_id" IS NULL)
      OR ("target_scope" = 'LEARNER_DETAIL' AND "target_id" IS NOT NULL)
    )
  )
);
CREATE OR REPLACE FUNCTION prevent_audit_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'AUDIT_EVENT_IMMUTABLE'; END; $$;
CREATE TRIGGER audit_events_immutable BEFORE UPDATE OR DELETE ON "audit_events" FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
