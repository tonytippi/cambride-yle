-- Media binaries live in the private object store; a media version records the immutable, content-addressed object it uses.
ALTER TABLE "media_drafts" ADD COLUMN "object_key" text;
ALTER TABLE "media_drafts" ADD COLUMN "content_type" text;
ALTER TABLE "media_drafts" ADD COLUMN "byte_size" integer;
ALTER TABLE "media_drafts" ADD COLUMN "content_sha256" text;
ALTER TABLE "media_drafts" ADD CONSTRAINT "media_drafts_file_check" CHECK (
  ("object_key" IS NULL AND "content_type" IS NULL AND "byte_size" IS NULL AND "content_sha256" IS NULL)
  OR ("object_key" = 'media/' || "content_sha256" AND "content_sha256" ~ '^[0-9a-f]{64}$' AND "byte_size" > 0
      AND "content_type" IN ('image/png', 'image/jpeg', 'image/webp', 'audio/wav', 'audio/ogg', 'audio/mpeg', 'audio/mp4'))
);
