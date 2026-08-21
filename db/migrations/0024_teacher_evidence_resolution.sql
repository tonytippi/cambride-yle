CREATE TABLE "teacher_evidence_resolutions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "review_item_id" uuid NOT NULL REFERENCES "practice_attempt_review_items"("id"),
  "revision" integer NOT NULL CHECK ("revision" >= 1),
  "effective_outcome" "evidence_outcome" NOT NULL CHECK ("effective_outcome" IN ('correct', 'incorrect', 'unanswered')),
  "reason" text NOT NULL CHECK (btrim("reason") <> ''),
  "resolver_id" uuid NOT NULL REFERENCES "accounts"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "teacher_evidence_resolutions_review_revision_unique" UNIQUE("review_item_id", "revision")
);
CREATE INDEX "teacher_evidence_resolutions_current_idx" ON "teacher_evidence_resolutions" ("review_item_id", "revision");
CREATE OR REPLACE FUNCTION enforce_teacher_evidence_resolution_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "practice_attempt_review_items" r
    JOIN "practice_attempts" a ON a.id = r.attempt_id
    JOIN "accounts" resolver ON resolver.id = NEW.resolver_id
    WHERE r.id = NEW.review_item_id AND r.outcome = 'needs_teacher_review' AND a.status = 'submitted'
      AND EXISTS (SELECT 1 FROM "submitted_evidence_facts" fact WHERE fact.review_item_id = r.id AND fact.attempt_id = a.id)
      AND resolver.status = 'active' AND resolver.role IN ('academic_lead', 'admin')
  ) THEN RAISE EXCEPTION 'TEACHER_RESOLUTION_SCOPE_INVALID'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER teacher_evidence_resolutions_scope_guard BEFORE INSERT ON "teacher_evidence_resolutions" FOR EACH ROW EXECUTE FUNCTION enforce_teacher_evidence_resolution_insert();
CREATE OR REPLACE FUNCTION prevent_teacher_evidence_resolution_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'TEACHER_EVIDENCE_RESOLUTION_IMMUTABLE'; END; $$;
CREATE TRIGGER teacher_evidence_resolutions_immutable BEFORE UPDATE OR DELETE ON "teacher_evidence_resolutions" FOR EACH ROW EXECUTE FUNCTION prevent_teacher_evidence_resolution_mutation();
DO $$
DECLARE constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'audit_events'::regclass
    AND contype = 'f'
    AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'audit_events'::regclass AND attname = 'target_id')];
  IF constraint_name IS NOT NULL THEN EXECUTE format('ALTER TABLE audit_events DROP CONSTRAINT %I', constraint_name); END IF;
END $$;
ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_evidence_read_outcome_check";
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_evidence_read_outcome_check" CHECK (
  ("action" NOT IN ('EVIDENCE_READ', 'EVIDENCE_RESOLUTION') AND "outcome" IS NULL AND "target_scope" IS NULL)
  OR ("action" = 'EVIDENCE_READ' AND "actor_id" IS NOT NULL AND "outcome" IN ('SUCCESS', 'NO_DATA') AND (("target_scope" = 'CENTRE_WIDE' AND "target_id" IS NULL) OR ("target_scope" = 'LEARNER_DETAIL' AND "target_id" IS NOT NULL)))
  OR ("action" = 'EVIDENCE_RESOLUTION' AND "actor_id" IS NOT NULL AND "target_id" IS NOT NULL AND "target_scope" = 'REVIEW_ITEM' AND "outcome" IN ('SUCCESS', 'CONFLICT'))
);
CREATE OR REPLACE FUNCTION enforce_audit_event_target_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.target_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.action = 'EVIDENCE_RESOLUTION' THEN
    IF NOT EXISTS (SELECT 1 FROM "practice_attempt_review_items" WHERE id = NEW.target_id) THEN
      RAISE EXCEPTION 'AUDIT_EVENT_TARGET_SCOPE_INVALID';
    END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM "accounts" WHERE id = NEW.target_id) THEN
    RAISE EXCEPTION 'AUDIT_EVENT_TARGET_SCOPE_INVALID';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER audit_events_target_scope_guard BEFORE INSERT ON "audit_events" FOR EACH ROW EXECUTE FUNCTION enforce_audit_event_target_scope();
