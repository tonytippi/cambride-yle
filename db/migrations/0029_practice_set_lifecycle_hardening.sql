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
    IF NOT EXISTS (
      SELECT 1 FROM practice_set_review_records approval
      WHERE approval.practice_set_id = OLD.id AND approval.decision = 'approved'
        AND EXISTS (
          SELECT 1 FROM practice_set_review_records submission
          WHERE submission.practice_set_id = OLD.id AND submission.decision = 'submitted'
            AND submission.actor_id <> approval.actor_id
        )
    ) THEN RAISE EXCEPTION 'PRACTICE_SET_APPROVAL_EVIDENCE_REQUIRED'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' AND NEW.status = 'published' THEN
    IF current_setting('app.practice_set_publication_id', true) IS DISTINCT FROM OLD.id::text THEN RAISE EXCEPTION 'PRACTICE_SET_PUBLICATION_TRANSACTION_REQUIRED'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'published' AND NEW.status = 'retired' AND (to_jsonb(NEW) - 'status') = (to_jsonb(OLD) - 'status') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'PRACTICE_SET_TRANSITION_INVALID';
END; $$;
DROP TRIGGER "practice_sets_immutable" ON "practice_sets";
CREATE TRIGGER "practice_sets_immutable" BEFORE INSERT OR UPDATE OR DELETE ON "practice_sets" FOR EACH ROW EXECUTE FUNCTION protect_practice_set();

CREATE OR REPLACE FUNCTION allow_practice_set_composition_in_creation_transaction() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE publication_set_id uuid;
BEGIN
  publication_set_id := CASE WHEN TG_TABLE_NAME = 'practice_set_items' THEN (to_jsonb(NEW)->>'practice_set_id')::uuid ELSE (SELECT item.practice_set_id FROM practice_set_items item WHERE item.id = (to_jsonb(NEW)->>'practice_set_item_id')::uuid) END;
  IF publication_set_id IS NOT NULL
    AND current_setting('app.practice_set_publication_id', true) = publication_set_id::text
    AND EXISTS (SELECT 1 FROM practice_sets set_row WHERE set_row.id = publication_set_id AND set_row.status = 'approved') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'PRACTICE_SET_COMPOSITION_IMMUTABLE';
END; $$;
