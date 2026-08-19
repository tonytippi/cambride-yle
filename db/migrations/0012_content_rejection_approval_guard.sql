CREATE OR REPLACE FUNCTION enforce_content_status_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'draft' AND NEW.status = 'in_review' THEN RETURN NEW; END IF;
  IF OLD.status = 'in_review' AND NEW.status = 'approved'
    AND NOT EXISTS (SELECT 1 FROM content_review_records WHERE kind = TG_ARGV[0]::content_kind AND target_id = OLD.id AND decision = 'rejected') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'CONTENT_STATUS_TRANSITION_INVALID';
END; $$;
DROP TRIGGER IF EXISTS question_drafts_status_transition ON "question_drafts";
DROP TRIGGER IF EXISTS media_drafts_status_transition ON "media_drafts";
CREATE TRIGGER question_drafts_status_transition BEFORE UPDATE ON "question_drafts" FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION enforce_content_status_transition('question');
CREATE TRIGGER media_drafts_status_transition BEFORE UPDATE ON "media_drafts" FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status) EXECUTE FUNCTION enforce_content_status_transition('media');
CREATE OR REPLACE FUNCTION enforce_content_review_reference() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE validation_kind "content_kind"; validation_target uuid;
BEGIN
  IF NEW.validation_result_id IS NULL THEN RAISE EXCEPTION 'CONTENT_REVIEW_VALIDATION_REQUIRED'; END IF;
  SELECT kind, target_id INTO validation_kind, validation_target FROM content_validation_results WHERE id = NEW.validation_result_id;
  IF NOT FOUND OR validation_kind <> NEW.kind OR validation_target <> NEW.target_id THEN RAISE EXCEPTION 'CONTENT_REVIEW_VALIDATION_MISMATCH'; END IF;
  IF NEW.kind = 'question' AND NOT EXISTS (SELECT 1 FROM question_drafts WHERE id = NEW.target_id) THEN RAISE EXCEPTION 'CONTENT_REVIEW_TARGET_MISMATCH'; END IF;
  IF NEW.kind = 'media' AND NOT EXISTS (SELECT 1 FROM media_drafts WHERE id = NEW.target_id) THEN RAISE EXCEPTION 'CONTENT_REVIEW_TARGET_MISMATCH'; END IF;
  RETURN NEW;
END; $$;
