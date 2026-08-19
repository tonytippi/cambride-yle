CREATE TABLE "question_version_media" (
  "id" uuid PRIMARY KEY NOT NULL,
  "question_version_id" uuid NOT NULL REFERENCES "question_drafts"("id"),
  "media_version_id" uuid NOT NULL REFERENCES "media_drafts"("id"),
  "position" integer NOT NULL,
  CONSTRAINT "question_version_media_question_media_unique" UNIQUE("question_version_id", "media_version_id"),
  CONSTRAINT "question_version_media_question_position_unique" UNIQUE("question_version_id", "position"),
  CONSTRAINT "question_version_media_position_check" CHECK ("position" > 0)
);

CREATE OR REPLACE FUNCTION enforce_question_version_media_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE question_record question_drafts; media_record media_drafts;
BEGIN
  SELECT * INTO question_record FROM question_drafts WHERE id = NEW.question_version_id FOR SHARE;
  SELECT * INTO media_record FROM media_drafts WHERE id = NEW.media_version_id FOR SHARE;
  IF question_record IS NULL OR media_record IS NULL THEN RAISE EXCEPTION 'QUESTION_MEDIA_REFERENCE_NOT_FOUND'; END IF;
  IF question_record.status <> 'draft' THEN RAISE EXCEPTION 'QUESTION_MEDIA_QUESTION_NOT_DRAFT'; END IF;
  IF question_record.paper <> media_record.paper OR question_record.part <> media_record.part OR question_record.engine <> media_record.engine THEN RAISE EXCEPTION 'QUESTION_MEDIA_SCOPE_MISMATCH'; END IF;
  RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION prevent_question_version_media_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QUESTION_MEDIA_ASSOCIATION_IMMUTABLE'; END; $$;
CREATE TRIGGER question_version_media_insert_guard BEFORE INSERT ON "question_version_media" FOR EACH ROW EXECUTE FUNCTION enforce_question_version_media_insert();
CREATE TRIGGER question_version_media_immutable BEFORE UPDATE OR DELETE ON "question_version_media" FOR EACH ROW EXECUTE FUNCTION prevent_question_version_media_mutation();
