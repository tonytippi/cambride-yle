CREATE TYPE "account_role" AS ENUM ('learner', 'teacher', 'academic_lead', 'admin');
CREATE TYPE "account_status" AS ENUM ('active', 'deactivated');

CREATE TABLE "accounts" (
  "id" uuid PRIMARY KEY,
  "email" text NOT NULL UNIQUE,
  "display_name" text NOT NULL,
  "role" "account_role" NOT NULL,
  "status" "account_status" NOT NULL DEFAULT 'active',
  "password_hash" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deactivated_at" timestamptz,
  "deactivated_by" uuid REFERENCES "accounts"("id"),
  CONSTRAINT "accounts_lifecycle_check" CHECK (("status" = 'active' AND "deactivated_at" IS NULL) OR ("status" = 'deactivated' AND "deactivated_at" IS NOT NULL))
);
CREATE TABLE "sessions" (
  "id" uuid PRIMARY KEY,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id"),
  "verifier_hash" text NOT NULL UNIQUE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz
);
CREATE INDEX "sessions_account_id_idx" ON "sessions" ("account_id");
CREATE INDEX "sessions_active_idx" ON "sessions" ("expires_at");
CREATE TABLE "oidc_identities" (
  "provider" text NOT NULL,
  "subject" text NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("provider", "subject")
);
CREATE INDEX "oidc_identities_account_id_idx" ON "oidc_identities" ("account_id");
CREATE TABLE "audit_events" (
  "id" uuid PRIMARY KEY,
  "actor_id" uuid REFERENCES "accounts"("id"),
  "action" text NOT NULL,
  "target_id" uuid REFERENCES "accounts"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "sign_in_throttles" (
  "key_hash" text PRIMARY KEY,
  "failures" integer NOT NULL DEFAULT 0,
  "window_started_at" timestamptz NOT NULL,
  "blocked_until" timestamptz
);
CREATE OR REPLACE FUNCTION set_accounts_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER accounts_set_updated_at BEFORE UPDATE ON "accounts"
FOR EACH ROW EXECUTE FUNCTION set_accounts_updated_at();
