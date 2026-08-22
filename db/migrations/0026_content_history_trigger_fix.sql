CREATE OR REPLACE FUNCTION prevent_content_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'CONTENT_DRAFT_HISTORY_IMMUTABLE';
END; $$;

DROP TRIGGER IF EXISTS content_generation_records_immutable ON "content_generation_records";
DROP TRIGGER IF EXISTS content_audit_events_immutable ON "content_audit_events";
CREATE TRIGGER content_generation_records_immutable BEFORE UPDATE OR DELETE ON "content_generation_records" FOR EACH ROW EXECUTE FUNCTION prevent_content_history_mutation();
CREATE TRIGGER content_audit_events_immutable BEFORE UPDATE OR DELETE ON "content_audit_events" FOR EACH ROW EXECUTE FUNCTION prevent_content_history_mutation();
