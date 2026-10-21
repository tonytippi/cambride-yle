-- The staff member who submits a practice set may also approve it (GATE-CONTENT-PLAN, amended 2026-10-21).
CREATE OR REPLACE FUNCTION protect_practice_set() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'draft' THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'PRACTICE_SET_INITIAL_STATUS_INVALID';
  END IF;
  IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - 'status') <> (to_jsonb(OLD) - 'status') THEN RAISE EXCEPTION 'PRACTICE_SET_METADATA_IMMUTABLE'; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'draft' AND NEW.status = 'in_review' THEN
    IF NOT EXISTS (SELECT 1 FROM practice_set_review_records WHERE practice_set_id = OLD.id AND decision = 'submitted') THEN RAISE EXCEPTION 'PRACTICE_SET_REVIEW_EVIDENCE_REQUIRED'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'in_review' AND NEW.status = 'approved' THEN
    IF NOT EXISTS (SELECT 1 FROM practice_set_review_records WHERE practice_set_id = OLD.id AND decision = 'approved') THEN RAISE EXCEPTION 'PRACTICE_SET_APPROVAL_EVIDENCE_REQUIRED'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' AND NEW.status = 'published' THEN
    IF current_setting('app.practice_set_publication_id', true) IS DISTINCT FROM OLD.id::text THEN RAISE EXCEPTION 'PRACTICE_SET_PUBLICATION_TRANSACTION_REQUIRED'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'published' AND NEW.status = 'retired' AND (to_jsonb(NEW) - 'status') = (to_jsonb(OLD) - 'status') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'PRACTICE_SET_TRANSITION_INVALID';
END; $$;
