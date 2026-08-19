ALTER TABLE "answer_policies" ADD COLUMN "guidance_id" uuid REFERENCES "curriculum_guidance"("id");

UPDATE "answer_policies" AS policy
SET "guidance_id" = (
  SELECT min(guidance."id")
  FROM "curriculum_guidance" AS guidance
  WHERE guidance."paper" = policy."paper"
    AND guidance."part" = policy."part"
    AND guidance."engine" = policy."engine"
  HAVING count(*) = 1
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "answer_policies" WHERE "guidance_id" IS NULL) THEN
    RAISE EXCEPTION 'ANSWER_POLICY_GUIDANCE_BACKFILL_AMBIGUOUS_OR_MISSING';
  END IF;
END;
$$;

ALTER TABLE "answer_policies" ALTER COLUMN "guidance_id" SET NOT NULL;
