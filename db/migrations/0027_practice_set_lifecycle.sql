ALTER TYPE "practice_set_status" ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE "practice_set_status" ADD VALUE IF NOT EXISTS 'in_review';
ALTER TYPE "practice_set_status" ADD VALUE IF NOT EXISTS 'approved';

CREATE TABLE "practice_set_compositions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "practice_set_id" uuid NOT NULL REFERENCES "practice_sets"("id"),
  "question_version_id" uuid NOT NULL REFERENCES "question_drafts"("id"),
  "position" integer NOT NULL,
  CONSTRAINT "practice_set_compositions_position_unique" UNIQUE("practice_set_id", "position"),
  CONSTRAINT "practice_set_compositions_question_unique" UNIQUE("practice_set_id", "question_version_id")
);
CREATE TABLE "practice_set_review_records" (
  "id" uuid PRIMARY KEY NOT NULL,
  "practice_set_id" uuid NOT NULL REFERENCES "practice_sets"("id"),
  "actor_id" uuid NOT NULL REFERENCES "accounts"("id"),
  "decision" text NOT NULL,
  "findings" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX "practice_set_review_records_set_idx" ON "practice_set_review_records" ("practice_set_id");
