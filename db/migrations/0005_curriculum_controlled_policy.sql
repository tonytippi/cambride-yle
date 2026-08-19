ALTER TABLE "answer_policies" ADD COLUMN "paper" "curriculum_paper" NOT NULL DEFAULT 'reading_writing';
ALTER TABLE "answer_policies" ADD COLUMN "part" integer NOT NULL DEFAULT 1;
ALTER TABLE "answer_policies" ADD CONSTRAINT "answer_policies_part_check" CHECK ("part" BETWEEN 1 AND 5);
CREATE OR REPLACE FUNCTION reject_curriculum_policy_history_change() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'CURRICULUM_POLICY_HISTORY_IMMUTABLE'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER answer_policy_versions_immutable BEFORE UPDATE OR DELETE ON "answer_policy_versions" FOR EACH ROW EXECUTE FUNCTION reject_curriculum_policy_history_change();
CREATE TRIGGER policy_conformance_vectors_immutable BEFORE UPDATE OR DELETE ON "policy_conformance_vectors" FOR EACH ROW EXECUTE FUNCTION reject_curriculum_policy_history_change();
