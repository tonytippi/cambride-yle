ALTER TABLE "accounts" ADD COLUMN "canonical_email" text;
UPDATE "accounts" SET "canonical_email" = lower(btrim("email"));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "accounts"
    GROUP BY "canonical_email"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce canonical account email uniqueness: duplicate canonical emails exist';
  END IF;
END;
$$;

ALTER TABLE "accounts" ALTER COLUMN "canonical_email" SET NOT NULL;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_canonical_email_unique" UNIQUE ("canonical_email");
