CREATE OR REPLACE FUNCTION enforce_content_status_transition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_validation uuid; current_findings jsonb; has_exception boolean;
BEGIN
  SELECT id, findings INTO current_validation, current_findings FROM content_validation_results WHERE kind = TG_ARGV[0]::content_kind AND target_id = OLD.id ORDER BY created_at DESC, id DESC LIMIT 1;
  IF OLD.status = 'draft' AND NEW.status = 'in_review' THEN
    IF current_validation IS NULL OR NOT EXISTS (SELECT 1 FROM content_review_records WHERE kind = TG_ARGV[0]::content_kind AND target_id = OLD.id AND decision = 'submitted' AND validation_result_id = current_validation) THEN RAISE EXCEPTION 'CONTENT_REVIEW_EVIDENCE_REQUIRED'; END IF;
    RETURN NEW;
  END IF;
  IF OLD.status = 'in_review' AND NEW.status = 'approved' THEN
    SELECT EXISTS (SELECT 1 FROM content_review_records WHERE kind = TG_ARGV[0]::content_kind AND target_id = OLD.id AND decision = 'exception' AND validation_result_id = current_validation) INTO has_exception;
    IF current_validation IS NULL OR NOT EXISTS (SELECT 1 FROM content_review_records WHERE kind = TG_ARGV[0]::content_kind AND target_id = OLD.id AND decision = 'approved' AND validation_result_id = current_validation) OR EXISTS (SELECT 1 FROM content_review_records WHERE kind = TG_ARGV[0]::content_kind AND target_id = OLD.id AND decision = 'rejected') OR (current_findings <> '[]'::jsonb AND NOT has_exception) THEN RAISE EXCEPTION 'CONTENT_APPROVAL_EVIDENCE_REQUIRED'; END IF;
    IF TG_ARGV[0] = 'media' AND EXISTS (SELECT 1 FROM media_drafts WHERE id = OLD.id AND media_type = 'image') AND NOT EXISTS (SELECT 1 FROM content_phone_preview_records WHERE target_id = OLD.id AND viewport_width = 375 AND successful = true) THEN RAISE EXCEPTION 'CONTENT_PHONE_PREVIEW_REQUIRED'; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'CONTENT_STATUS_TRANSITION_INVALID';
END; $$;
