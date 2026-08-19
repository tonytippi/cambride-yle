import { check, index, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { accounts } from "./identity";
import { answerPolicyVersions, curriculumEngine, curriculumGuidance, curriculumLevel, curriculumPaper, curriculumTargets } from "./curriculum";

export const contentStatus = pgEnum("content_status", ["draft"]);
export const contentOrigin = pgEnum("content_origin", ["manual", "generated"]);
export const contentKind = pgEnum("content_kind", ["question", "media"]);
export const contentGatewayKind = pgEnum("content_gateway_kind", ["text", "image"]);

const contentFields = {
  id: uuid("id").primaryKey(),
  status: contentStatus("status").notNull().default("draft"),
  origin: contentOrigin("origin").notNull(),
  level: curriculumLevel("level").notNull().default("starters"),
  paper: curriculumPaper("paper").notNull(),
  part: text("part").notNull(),
  engine: curriculumEngine("engine").notNull(),
  primaryTargetId: uuid("primary_target_id").notNull().references(() => curriculumTargets.id),
  supportingTargetIds: jsonb("supporting_target_ids").notNull(),
  topicIds: jsonb("topic_ids").notNull(),
  guidanceId: uuid("guidance_id").notNull().references(() => curriculumGuidance.id),
  estimatedDurationSeconds: text("estimated_duration_seconds").notNull(),
  accessibilityMetadata: jsonb("accessibility_metadata").notNull(),
  provenance: jsonb("provenance").notNull(),
  createdBy: uuid("created_by").notNull().references(() => accounts.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
};

export const questionDrafts = pgTable("question_drafts", {
  ...contentFields,
  sourceVersionId: uuid("source_version_id"),
  answerPolicyVersionId: uuid("answer_policy_version_id").notNull().references(() => answerPolicyVersions.id),
  prompt: text("prompt").notNull(),
  options: jsonb("options").notNull(),
}, (table) => [
  check("question_drafts_part_check", sql`${table.part} ~ '^[1-5]$'`),
  check("question_drafts_duration_check", sql`${table.estimatedDurationSeconds} ~ '^[1-9][0-9]*$'`),
  index("question_drafts_source_idx").on(table.sourceVersionId),
]);

export const mediaDrafts = pgTable("media_drafts", {
  ...contentFields,
  sourceVersionId: uuid("source_version_id"),
  mediaType: text("media_type").notNull(),
  previewUrl: text("preview_url"),
  description: text("description").notNull(),
}, (table) => [
  check("media_drafts_part_check", sql`${table.part} ~ '^[1-5]$'`),
  check("media_drafts_duration_check", sql`${table.estimatedDurationSeconds} ~ '^[1-9][0-9]*$'`),
  index("media_drafts_source_idx").on(table.sourceVersionId),
]);

export const contentAuditEvents = pgTable("content_audit_events", {
  id: uuid("id").primaryKey(),
  actorId: uuid("actor_id").notNull().references(() => accounts.id),
  action: text("action").notNull(),
  kind: contentKind("kind").notNull(),
  targetId: uuid("target_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("content_audit_events_target_idx").on(table.targetId)]);

export const contentGenerationRecords = pgTable("content_generation_records", {
  id: uuid("id").primaryKey(),
  kind: contentKind("kind").notNull(),
  targetId: uuid("target_id").notNull(),
  gatewayKind: contentGatewayKind("gateway_kind").notNull(),
  endpoint: text("endpoint").notNull(),
  model: text("model").notNull(),
  promptProvenance: jsonb("prompt_provenance").notNull(),
  referenceProvenance: jsonb("reference_provenance").notNull(),
  outputHash: text("output_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [unique("content_generation_records_target_unique").on(table.targetId)]);
