ALTER TABLE "question_drafts" ADD COLUMN "evidence_dimensions" jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "media_drafts" ADD COLUMN "evidence_dimensions" jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE OR REPLACE FUNCTION valid_content_evidence_dimensions(value jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_typeof(value) = 'object'
    AND value - ARRAY['spelling', 'colours', 'positions'] = '{}'::jsonb
    AND NOT EXISTS (SELECT 1 FROM jsonb_each(value) AS dimension(key, item) WHERE jsonb_typeof(item) <> 'array' OR EXISTS (SELECT 1 FROM jsonb_array_elements(item) AS entry(value) WHERE jsonb_typeof(entry.value) <> 'string'));
$$;
ALTER TABLE "question_drafts" ADD CONSTRAINT "question_drafts_evidence_dimensions_check" CHECK (valid_content_evidence_dimensions("evidence_dimensions"));
ALTER TABLE "media_drafts" ADD CONSTRAINT "media_drafts_evidence_dimensions_check" CHECK (valid_content_evidence_dimensions("evidence_dimensions"));
