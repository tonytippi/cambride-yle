CREATE TYPE "curriculum_engine" AS ENUM ('picture_true_false', 'picture_yes_no', 'audio_picture_choice', 'audio_note_taking', 'word_bank_cloze');
ALTER TABLE "curriculum_guidance" DROP CONSTRAINT "curriculum_guidance_engine_unique";
ALTER TABLE "curriculum_guidance" ALTER COLUMN "engine" TYPE "curriculum_engine" USING "engine"::"curriculum_engine";
ALTER TABLE "curriculum_guidance" ADD COLUMN "approved_numbers" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "curriculum_guidance" ADD CONSTRAINT "curriculum_guidance_record_unique" UNIQUE ("paper", "part", "engine", "topic", "task_format");
ALTER TABLE "answer_policies" ADD COLUMN "engine" "curriculum_engine" NOT NULL DEFAULT 'picture_true_false';
ALTER TABLE "answer_policy_versions" ALTER COLUMN "teacher_review_if_uncertain" TYPE boolean USING "teacher_review_if_uncertain"::boolean;
ALTER TABLE "answer_policy_versions" ADD CONSTRAINT "answer_policy_versions_id_policy_unique" UNIQUE ("id", "policy_id");
ALTER TABLE "answer_policies" ADD CONSTRAINT "answer_policies_current_version_owned" FOREIGN KEY ("current_version_id", "id") REFERENCES "answer_policy_versions"("id", "policy_id") DEFERRABLE INITIALLY DEFERRED;
