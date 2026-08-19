CREATE TYPE "content_status" AS ENUM ('draft');
CREATE TYPE "content_origin" AS ENUM ('manual', 'generated');
CREATE TYPE "content_kind" AS ENUM ('question', 'media');
CREATE TYPE "content_gateway_kind" AS ENUM ('text', 'image');

CREATE TABLE "question_drafts" (
  "id" uuid PRIMARY KEY NOT NULL, "source_version_id" uuid REFERENCES "question_drafts"("id"), "status" "content_status" DEFAULT 'draft' NOT NULL,
  "origin" "content_origin" NOT NULL, "level" "curriculum_level" DEFAULT 'starters' NOT NULL,
  "paper" "curriculum_paper" NOT NULL, "part" text NOT NULL, "engine" "curriculum_engine" NOT NULL,
  "primary_target_id" uuid NOT NULL REFERENCES "curriculum_targets"("id"), "supporting_target_ids" jsonb NOT NULL,
  "topic_ids" jsonb NOT NULL, "guidance_id" uuid NOT NULL REFERENCES "curriculum_guidance"("id"),
  "estimated_duration_seconds" text NOT NULL, "accessibility_metadata" jsonb NOT NULL, "provenance" jsonb NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "accounts"("id"), "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "answer_policy_version_id" uuid NOT NULL REFERENCES "answer_policy_versions"("id"), "prompt" text NOT NULL, "options" jsonb NOT NULL,
  CONSTRAINT "question_drafts_part_check" CHECK ("part" ~ '^[1-5]$'), CONSTRAINT "question_drafts_duration_check" CHECK ("estimated_duration_seconds" ~ '^[1-9][0-9]*$')
);
CREATE TABLE "media_drafts" (
  "id" uuid PRIMARY KEY NOT NULL, "source_version_id" uuid REFERENCES "media_drafts"("id"), "status" "content_status" DEFAULT 'draft' NOT NULL,
  "origin" "content_origin" NOT NULL, "level" "curriculum_level" DEFAULT 'starters' NOT NULL,
  "paper" "curriculum_paper" NOT NULL, "part" text NOT NULL, "engine" "curriculum_engine" NOT NULL,
  "primary_target_id" uuid NOT NULL REFERENCES "curriculum_targets"("id"), "supporting_target_ids" jsonb NOT NULL,
  "topic_ids" jsonb NOT NULL, "guidance_id" uuid NOT NULL REFERENCES "curriculum_guidance"("id"),
  "estimated_duration_seconds" text NOT NULL, "accessibility_metadata" jsonb NOT NULL, "provenance" jsonb NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "accounts"("id"), "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "media_type" text NOT NULL, "preview_url" text, "description" text NOT NULL,
  CONSTRAINT "media_drafts_part_check" CHECK ("part" ~ '^[1-5]$'), CONSTRAINT "media_drafts_duration_check" CHECK ("estimated_duration_seconds" ~ '^[1-9][0-9]*$')
);
CREATE TABLE "content_audit_events" ("id" uuid PRIMARY KEY NOT NULL, "actor_id" uuid NOT NULL REFERENCES "accounts"("id"), "action" text NOT NULL, "kind" "content_kind" NOT NULL, "target_id" uuid NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE "content_generation_records" ("id" uuid PRIMARY KEY NOT NULL, "kind" "content_kind" NOT NULL, "target_id" uuid NOT NULL, "gateway_kind" "content_gateway_kind" NOT NULL, "endpoint" text NOT NULL, "model" text NOT NULL, "prompt_provenance" jsonb NOT NULL, "reference_provenance" jsonb NOT NULL, "output_hash" text NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL, CONSTRAINT "content_generation_records_target_unique" UNIQUE("target_id"));
CREATE INDEX "question_drafts_source_idx" ON "question_drafts" USING btree ("source_version_id");
CREATE INDEX "media_drafts_source_idx" ON "media_drafts" USING btree ("source_version_id");
CREATE INDEX "content_audit_events_target_idx" ON "content_audit_events" USING btree ("target_id");

CREATE FUNCTION prevent_content_draft_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'CONTENT_DRAFT_HISTORY_IMMUTABLE'; END; $$;
CREATE TRIGGER question_drafts_immutable BEFORE UPDATE OR DELETE ON "question_drafts" FOR EACH ROW EXECUTE FUNCTION prevent_content_draft_history_mutation();
CREATE TRIGGER media_drafts_immutable BEFORE UPDATE OR DELETE ON "media_drafts" FOR EACH ROW EXECUTE FUNCTION prevent_content_draft_history_mutation();
CREATE TRIGGER content_generation_records_immutable BEFORE UPDATE OR DELETE ON "content_generation_records" FOR EACH ROW EXECUTE FUNCTION prevent_content_draft_history_mutation();
CREATE TRIGGER content_audit_events_immutable BEFORE UPDATE OR DELETE ON "content_audit_events" FOR EACH ROW EXECUTE FUNCTION prevent_content_draft_history_mutation();
