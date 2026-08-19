ALTER TABLE "question_drafts" ADD COLUMN "post_submit_hint" jsonb;

CREATE TABLE "practice_sets" (
  "id" uuid PRIMARY KEY NOT NULL, "status" "practice_set_status" DEFAULT 'published' NOT NULL,
  "paper" "curriculum_paper" NOT NULL, "part" text NOT NULL, "estimated_duration_seconds" integer NOT NULL,
  "primary_target_ids" jsonb NOT NULL, "created_by" uuid NOT NULL REFERENCES "accounts"("id"), "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "practice_sets_part_check" CHECK ("part" ~ '^[1-5]$'), CONSTRAINT "practice_sets_duration_check" CHECK ("estimated_duration_seconds" BETWEEN 300 AND 600)
);
CREATE TABLE "practice_set_items" (
  "id" uuid PRIMARY KEY NOT NULL, "practice_set_id" uuid NOT NULL REFERENCES "practice_sets"("id"), "position" integer NOT NULL,
  "question_version_id" uuid NOT NULL REFERENCES "question_drafts"("id"), "engine" "curriculum_engine" NOT NULL,
  "rendered_prompt" text NOT NULL, "rendered_options" jsonb NOT NULL, "answer_policy" jsonb NOT NULL, "feedback" jsonb NOT NULL,
  "tags" jsonb NOT NULL, "accessibility_metadata" jsonb NOT NULL, "provenance" jsonb NOT NULL,
  CONSTRAINT "practice_set_items_position_unique" UNIQUE("practice_set_id", "position")
);
CREATE TABLE "practice_set_item_media" (
  "id" uuid PRIMARY KEY NOT NULL, "practice_set_item_id" uuid NOT NULL REFERENCES "practice_set_items"("id"),
  "media_version_id" uuid NOT NULL REFERENCES "media_drafts"("id"), "media_type" text NOT NULL, "object_version" text NOT NULL,
  "content_hash" text NOT NULL, "accessibility_metadata" jsonb NOT NULL, "provenance" jsonb NOT NULL
);
CREATE TABLE "practice_set_audit_events" (
  "id" uuid PRIMARY KEY NOT NULL, "actor_id" uuid NOT NULL REFERENCES "accounts"("id"), "action" text NOT NULL,
  "practice_set_id" uuid NOT NULL REFERENCES "practice_sets"("id"), "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "practice_set_audit_events_set_idx" ON "practice_set_audit_events" USING btree ("practice_set_id");

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
  IF OLD.status = 'approved' AND NEW.status = 'published' THEN RETURN NEW; END IF;
  IF OLD.status = 'published' AND NEW.status = 'retired' THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'CONTENT_STATUS_TRANSITION_INVALID';
END; $$;

CREATE OR REPLACE FUNCTION prevent_published_content_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'published' AND NEW.status = 'retired'
    AND (to_jsonb(NEW) - 'status') = (to_jsonb(OLD) - 'status') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'PUBLISHED_CONTENT_IMMUTABLE';
END; $$;
CREATE OR REPLACE FUNCTION prevent_practice_set_snapshot_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'PRACTICE_SET_SNAPSHOT_IMMUTABLE'; END; $$;
CREATE OR REPLACE FUNCTION protect_practice_set() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'published' AND NEW.status = 'retired'
    AND (to_jsonb(NEW) - 'status') = (to_jsonb(OLD) - 'status') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'PRACTICE_SET_SNAPSHOT_IMMUTABLE';
END; $$;
CREATE OR REPLACE FUNCTION allow_practice_set_composition_in_creation_transaction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'practice_set_items' AND EXISTS (
    SELECT 1 FROM practice_sets WHERE id = NEW.practice_set_id AND xmin = txid_current()::text::xid
  ) THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'practice_set_item_media' AND EXISTS (
    SELECT 1 FROM practice_set_items WHERE id = NEW.practice_set_item_id AND xmin = txid_current()::text::xid
  ) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'PRACTICE_SET_COMPOSITION_IMMUTABLE';
END; $$;
CREATE TRIGGER question_drafts_published_immutable BEFORE UPDATE OR DELETE ON "question_drafts" FOR EACH ROW WHEN (OLD.status = 'published') EXECUTE FUNCTION prevent_published_content_mutation();
CREATE TRIGGER media_drafts_published_immutable BEFORE UPDATE OR DELETE ON "media_drafts" FOR EACH ROW WHEN (OLD.status = 'published') EXECUTE FUNCTION prevent_published_content_mutation();
CREATE TRIGGER practice_sets_immutable BEFORE UPDATE OR DELETE ON "practice_sets" FOR EACH ROW EXECUTE FUNCTION protect_practice_set();
CREATE TRIGGER practice_set_items_creation_only BEFORE INSERT ON "practice_set_items" FOR EACH ROW EXECUTE FUNCTION allow_practice_set_composition_in_creation_transaction();
CREATE TRIGGER practice_set_item_media_creation_only BEFORE INSERT ON "practice_set_item_media" FOR EACH ROW EXECUTE FUNCTION allow_practice_set_composition_in_creation_transaction();
CREATE TRIGGER practice_set_items_immutable BEFORE UPDATE OR DELETE ON "practice_set_items" FOR EACH ROW EXECUTE FUNCTION prevent_practice_set_snapshot_mutation();
CREATE TRIGGER practice_set_item_media_immutable BEFORE UPDATE OR DELETE ON "practice_set_item_media" FOR EACH ROW EXECUTE FUNCTION prevent_practice_set_snapshot_mutation();
CREATE TRIGGER practice_set_audit_events_immutable BEFORE UPDATE OR DELETE ON "practice_set_audit_events" FOR EACH ROW EXECUTE FUNCTION prevent_practice_set_snapshot_mutation();
