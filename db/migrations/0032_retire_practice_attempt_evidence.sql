-- practice_attempt_evidence is retired: learner and teacher evidence read submitted_evidence_facts.
-- Existing rows stay immutable and readable; new submissions no longer write here.
COMMENT ON TABLE "practice_attempt_evidence" IS 'Retired 2026-10-20: historical attempt-level labels; superseded by submitted_evidence_facts. Read-only.';
CREATE OR REPLACE FUNCTION enforce_practice_attempt_evidence_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'PRACTICE_ATTEMPT_EVIDENCE_RETIRED';
END; $$;
