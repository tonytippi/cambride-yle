ALTER TABLE "submitted_evidence_facts" ADD COLUMN "dimensions" jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX "submitted_evidence_facts_filter_idx" ON "submitted_evidence_facts" ("learner_id", "paper", "part", "practice_set_id", "submitted_at");
CREATE OR REPLACE FUNCTION enforce_submitted_evidence_fact_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF jsonb_typeof(NEW.dimensions) <> 'object'
    OR NEW.dimensions - ARRAY['vocabulary', 'grammar', 'spelling', 'names', 'numbers', 'colours', 'positions', 'topic'] <> '{}'::jsonb
    OR EXISTS (SELECT 1 FROM jsonb_each(NEW.dimensions) AS dimension(key, value) WHERE jsonb_typeof(value) <> 'array' OR EXISTS (SELECT 1 FROM jsonb_array_elements(value) AS entry(value) WHERE jsonb_typeof(entry.value) <> 'string'))
  THEN RAISE EXCEPTION 'SUBMITTED_EVIDENCE_FACT_DIMENSIONS_INVALID'; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM practice_attempts a
    JOIN practice_attempt_review_items r ON r.id = NEW.review_item_id AND r.attempt_id = a.id
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(r.curriculum_tags -> 'evidenceTargets') = 'array' THEN r.curriculum_tags -> 'evidenceTargets' ELSE '[]'::jsonb END) AS target(value)
    WHERE a.id = NEW.attempt_id AND a.learner_id = NEW.learner_id AND a.practice_set_id = NEW.practice_set_id
      AND a.status = 'submitted' AND a.submitted_presentation ->> 'paper' = NEW.paper AND a.submitted_presentation ->> 'part' = NEW.part
      AND r.outcome::text = NEW.automatic_outcome::text AND (target.value ->> 'id') = NEW.language_target_id::text
      AND (target.value ->> 'label') = NEW.language_target AND COALESCE(r.curriculum_tags -> 'dimensions', '{}'::jsonb) = NEW.dimensions
  ) THEN RAISE EXCEPTION 'SUBMITTED_EVIDENCE_FACT_SCOPE_INVALID'; END IF;
  RETURN NEW;
END; $$;
-- Dimensions are copied exactly from the immutable submitted review snapshot. Historical rows deliberately remain empty.
