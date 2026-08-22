CREATE OR REPLACE FUNCTION allow_practice_set_composition_in_creation_transaction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'practice_set_items' AND EXISTS (
    SELECT 1 FROM practice_sets WHERE id = (to_jsonb(NEW)->>'practice_set_id')::uuid AND xmin = txid_current()::text::xid
  ) THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'practice_set_item_media' AND EXISTS (
    SELECT 1 FROM practice_set_items WHERE id = (to_jsonb(NEW)->>'practice_set_item_id')::uuid
      AND practice_set_id IN (SELECT id FROM practice_sets WHERE xmin = txid_current()::text::xid)
  ) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'PRACTICE_SET_COMPOSITION_IMMUTABLE';
END; $$;
