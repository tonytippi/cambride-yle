CREATE OR REPLACE FUNCTION prevent_content_review_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'CONTENT_REVIEW_HISTORY_IMMUTABLE'; END; $$;
DROP TRIGGER IF EXISTS content_validation_results_immutable ON "content_validation_results";
DROP TRIGGER IF EXISTS content_review_records_immutable ON "content_review_records";
DROP TRIGGER IF EXISTS content_phone_preview_records_immutable ON "content_phone_preview_records";
CREATE TRIGGER content_validation_results_immutable BEFORE UPDATE OR DELETE ON "content_validation_results" FOR EACH ROW EXECUTE FUNCTION prevent_content_review_history_mutation();
CREATE TRIGGER content_review_records_immutable BEFORE UPDATE OR DELETE ON "content_review_records" FOR EACH ROW EXECUTE FUNCTION prevent_content_review_history_mutation();
CREATE TRIGGER content_phone_preview_records_immutable BEFORE UPDATE OR DELETE ON "content_phone_preview_records" FOR EACH ROW EXECUTE FUNCTION prevent_content_review_history_mutation();
