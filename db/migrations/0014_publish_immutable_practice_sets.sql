ALTER TYPE "content_status" ADD VALUE IF NOT EXISTS 'published';
ALTER TYPE "content_status" ADD VALUE IF NOT EXISTS 'retired';
CREATE TYPE "practice_set_status" AS ENUM ('published', 'retired');
