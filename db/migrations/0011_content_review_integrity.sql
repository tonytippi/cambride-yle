ALTER TABLE "content_review_records" ADD COLUMN "validation_result_id" uuid REFERENCES "content_validation_results"("id");
ALTER TABLE "content_phone_preview_records" DROP CONSTRAINT "content_phone_preview_width_check";
ALTER TABLE "content_phone_preview_records" DROP CONSTRAINT "content_phone_preview_success_check";
ALTER TABLE "content_phone_preview_records" ALTER COLUMN "viewport_width" TYPE integer USING "viewport_width"::integer;
ALTER TABLE "content_phone_preview_records" ALTER COLUMN "successful" TYPE boolean USING "successful"::boolean;
ALTER TABLE "content_phone_preview_records" ADD CONSTRAINT "content_phone_preview_width_check" CHECK ("viewport_width" = 375);
ALTER TABLE "content_phone_preview_records" ADD CONSTRAINT "content_phone_preview_success_check" CHECK ("successful" = true);

CREATE OR REPLACE FUNCTION enforce_content_status_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'draft' AND NEW.status = 'in_review' THEN RETURN NEW; END IF;
  IF OLD.status = 'in_review' AND NEW.status = 'approved'
    AND NOT EXISTS (SELECT 1 FROM content_review_records WHERE kind = TG_ARGV[0]::content_kind AND target_id = OLD.id AND decision = 'rejected') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'CONTENT_STATUS_TRANSITION_INVALID';
END; $$;
DROP TRIGGER IF EXISTS question_drafts_immutable ON "question_drafts";
DROP TRIGGER IF EXISTS media_drafts_immutable ON "media_drafts";
CREATE TRIGGER question_drafts_immutable BEFORE UPDATE OR DELETE ON "question_drafts" FOR EACH ROW EXECUTE FUNCTION prevent_content_draft_history_mutation();
CREATE TRIGGER media_drafts_immutable BEFORE UPDATE OR DELETE ON "media_drafts" FOR EACH ROW EXECUTE FUNCTION prevent_content_draft_history_mutation();
CREATE TRIGGER question_drafts_status_transition BEFORE UPDATE ON "question_drafts" FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION enforce_content_status_transition('question');
CREATE TRIGGER media_drafts_status_transition BEFORE UPDATE ON "media_drafts" FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION enforce_content_status_transition('media');

CREATE OR REPLACE FUNCTION enforce_content_review_reference() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE validation_kind "content_kind"; validation_target uuid;
BEGIN
  IF NEW.validation_result_id IS NOT NULL THEN
    SELECT kind, target_id INTO validation_kind, validation_target FROM content_validation_results WHERE id = NEW.validation_result_id;
    IF NOT FOUND OR validation_kind <> NEW.kind OR validation_target <> NEW.target_id THEN RAISE EXCEPTION 'CONTENT_REVIEW_VALIDATION_MISMATCH'; END IF;
  END IF;
  IF NEW.validation_result_id IS NULL THEN RAISE EXCEPTION 'CONTENT_REVIEW_VALIDATION_REQUIRED'; END IF;
  IF NEW.kind = 'question' AND NOT EXISTS (SELECT 1 FROM question_drafts WHERE id = NEW.target_id) THEN RAISE EXCEPTION 'CONTENT_REVIEW_TARGET_MISMATCH'; END IF;
  IF NEW.kind = 'media' AND NOT EXISTS (SELECT 1 FROM media_drafts WHERE id = NEW.target_id) THEN RAISE EXCEPTION 'CONTENT_REVIEW_TARGET_MISMATCH'; END IF;
  RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION enforce_phone_preview_reference() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM media_drafts WHERE id = NEW.target_id AND media_type = 'image' AND status = 'in_review') THEN RAISE EXCEPTION 'CONTENT_PHONE_PREVIEW_TARGET_INVALID'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER content_review_records_reference BEFORE INSERT ON "content_review_records" FOR EACH ROW EXECUTE FUNCTION enforce_content_review_reference();
CREATE TRIGGER content_phone_preview_records_reference BEFORE INSERT ON "content_phone_preview_records" FOR EACH ROW EXECUTE FUNCTION enforce_phone_preview_reference();
