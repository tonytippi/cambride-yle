ALTER TYPE "content_status" ADD VALUE IF NOT EXISTS 'in_review';
ALTER TYPE "content_status" ADD VALUE IF NOT EXISTS 'approved';
CREATE TYPE "content_review_decision" AS ENUM ('submitted', 'approved', 'rejected', 'exception');

CREATE OR REPLACE FUNCTION prevent_content_draft_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
    AND (to_jsonb(NEW) - 'status') = (to_jsonb(OLD) - 'status') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'CONTENT_DRAFT_HISTORY_IMMUTABLE';
END; $$;
CREATE FUNCTION prevent_content_review_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'CONTENT_REVIEW_HISTORY_IMMUTABLE'; END; $$;

CREATE TABLE "content_validation_results" ("id" uuid PRIMARY KEY NOT NULL, "kind" "content_kind" NOT NULL, "target_id" uuid NOT NULL, "actor_id" uuid NOT NULL REFERENCES "accounts"("id"), "findings" jsonb NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE "content_review_records" ("id" uuid PRIMARY KEY NOT NULL, "kind" "content_kind" NOT NULL, "target_id" uuid NOT NULL, "actor_id" uuid NOT NULL REFERENCES "accounts"("id"), "decision" "content_review_decision" NOT NULL, "reason" text, "findings" jsonb DEFAULT '[]'::jsonb NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL, CONSTRAINT "content_review_records_reason_check" CHECK (("decision" NOT IN ('rejected', 'exception')) OR length(btrim("reason")) > 0));
CREATE TABLE "content_phone_preview_records" ("id" uuid PRIMARY KEY NOT NULL, "target_id" uuid NOT NULL, "actor_id" uuid NOT NULL REFERENCES "accounts"("id"), "viewport_width" text NOT NULL, "successful" text NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL, CONSTRAINT "content_phone_preview_width_check" CHECK ("viewport_width" = '375'), CONSTRAINT "content_phone_preview_success_check" CHECK ("successful" IN ('true', 'false')));
CREATE INDEX "content_validation_results_target_idx" ON "content_validation_results" USING btree ("target_id");
CREATE INDEX "content_review_records_target_idx" ON "content_review_records" USING btree ("target_id");
CREATE INDEX "content_phone_preview_target_idx" ON "content_phone_preview_records" USING btree ("target_id");
CREATE TRIGGER content_validation_results_immutable BEFORE UPDATE OR DELETE ON "content_validation_results" FOR EACH ROW EXECUTE FUNCTION prevent_content_review_history_mutation();
CREATE TRIGGER content_review_records_immutable BEFORE UPDATE OR DELETE ON "content_review_records" FOR EACH ROW EXECUTE FUNCTION prevent_content_review_history_mutation();
CREATE TRIGGER content_phone_preview_records_immutable BEFORE UPDATE OR DELETE ON "content_phone_preview_records" FOR EACH ROW EXECUTE FUNCTION prevent_content_review_history_mutation();
