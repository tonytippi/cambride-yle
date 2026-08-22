CREATE OR REPLACE FUNCTION allow_practice_set_composition_in_creation_transaction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'practice_set_items' AND EXISTS (
    SELECT 1 FROM practice_sets WHERE id = (to_jsonb(NEW)->>'practice_set_id')::uuid AND status = 'approved'
  ) THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'practice_set_item_media' AND EXISTS (
    SELECT 1 FROM practice_set_items WHERE id = (to_jsonb(NEW)->>'practice_set_item_id')::uuid
      AND practice_set_id IN (SELECT id FROM practice_sets WHERE status = 'approved')
  ) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'PRACTICE_SET_COMPOSITION_IMMUTABLE';
END; $$;
ALTER TABLE "practice_sets" ALTER COLUMN "status" SET DEFAULT 'draft';

CREATE OR REPLACE FUNCTION protect_practice_set() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'draft' AND NEW.status IN ('draft', 'in_review') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'in_review' AND NEW.status = 'approved' THEN
    IF NOT EXISTS (SELECT 1 FROM practice_set_review_records WHERE practice_set_id = OLD.id AND decision = 'approved') THEN RAISE EXCEPTION 'PRACTICE_SET_APPROVAL_EVIDENCE_REQUIRED'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' AND NEW.status = 'published' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'published' AND NEW.status = 'retired' AND (to_jsonb(NEW) - 'status') = (to_jsonb(OLD) - 'status') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'PRACTICE_SET_TRANSITION_INVALID';
END; $$;
CREATE OR REPLACE FUNCTION guard_practice_set_composition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE set_status practice_set_status; set_id uuid;
BEGIN
  set_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.practice_set_id ELSE NEW.practice_set_id END;
  SELECT status INTO set_status FROM practice_sets WHERE id = set_id;
  IF set_status = 'draft' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'PRACTICE_SET_COMPOSITION_IMMUTABLE';
END; $$;
CREATE TRIGGER practice_set_compositions_draft_only BEFORE INSERT OR UPDATE OR DELETE ON "practice_set_compositions" FOR EACH ROW EXECUTE FUNCTION guard_practice_set_composition();
CREATE TRIGGER practice_set_review_records_immutable BEFORE UPDATE OR DELETE ON "practice_set_review_records" FOR EACH ROW EXECUTE FUNCTION prevent_practice_set_snapshot_mutation();
