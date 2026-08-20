import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { accounts } from "./identity";
import {
  answerPolicyVersions,
  curriculumEngine,
  curriculumGuidance,
  curriculumLevel,
  curriculumPaper,
  curriculumTargets,
} from "./curriculum";

export const contentStatus = pgEnum("content_status", [
  "draft",
  "in_review",
  "approved",
  "published",
  "retired",
]);
export const contentOrigin = pgEnum("content_origin", ["manual", "generated"]);
export const contentKind = pgEnum("content_kind", ["question", "media"]);
export const contentGatewayKind = pgEnum("content_gateway_kind", [
  "text",
  "image",
]);
export const contentReviewDecision = pgEnum("content_review_decision", [
  "submitted",
  "approved",
  "rejected",
  "exception",
]);

const contentFields = {
  id: uuid("id").primaryKey(),
  status: contentStatus("status").notNull().default("draft"),
  origin: contentOrigin("origin").notNull(),
  level: curriculumLevel("level").notNull().default("starters"),
  paper: curriculumPaper("paper").notNull(),
  part: text("part").notNull(),
  engine: curriculumEngine("engine").notNull(),
  primaryTargetId: uuid("primary_target_id")
    .notNull()
    .references(() => curriculumTargets.id),
  supportingTargetIds: jsonb("supporting_target_ids").notNull(),
  topicIds: jsonb("topic_ids").notNull(),
  guidanceId: uuid("guidance_id")
    .notNull()
    .references(() => curriculumGuidance.id),
  estimatedDurationSeconds: text("estimated_duration_seconds").notNull(),
  accessibilityMetadata: jsonb("accessibility_metadata").notNull(),
  provenance: jsonb("provenance").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => accounts.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export const questionDrafts = pgTable(
  "question_drafts",
  {
    ...contentFields,
    sourceVersionId: uuid("source_version_id"),
    answerPolicyVersionId: uuid("answer_policy_version_id")
      .notNull()
      .references(() => answerPolicyVersions.id),
    prompt: text("prompt").notNull(),
    options: jsonb("options").notNull(),
    postSubmitHint: jsonb("post_submit_hint"),
  },
  (table) => [
    check("question_drafts_part_check", sql`${table.part} ~ '^[1-5]$'`),
    check(
      "question_drafts_duration_check",
      sql`${table.estimatedDurationSeconds} ~ '^[1-9][0-9]*$'`,
    ),
    index("question_drafts_source_idx").on(table.sourceVersionId),
  ],
);

export const mediaDrafts = pgTable(
  "media_drafts",
  {
    ...contentFields,
    sourceVersionId: uuid("source_version_id"),
    mediaType: text("media_type").notNull(),
    previewUrl: text("preview_url"),
    description: text("description").notNull(),
  },
  (table) => [
    check("media_drafts_part_check", sql`${table.part} ~ '^[1-5]$'`),
    check(
      "media_drafts_duration_check",
      sql`${table.estimatedDurationSeconds} ~ '^[1-9][0-9]*$'`,
    ),
    index("media_drafts_source_idx").on(table.sourceVersionId),
  ],
);

export const contentAuditEvents = pgTable(
  "content_audit_events",
  {
    id: uuid("id").primaryKey(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => accounts.id),
    action: text("action").notNull(),
    kind: contentKind("kind").notNull(),
    targetId: uuid("target_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("content_audit_events_target_idx").on(table.targetId)],
);

export const contentGenerationRecords = pgTable(
  "content_generation_records",
  {
    id: uuid("id").primaryKey(),
    kind: contentKind("kind").notNull(),
    targetId: uuid("target_id").notNull(),
    gatewayKind: contentGatewayKind("gateway_kind").notNull(),
    endpoint: text("endpoint").notNull(),
    model: text("model").notNull(),
    promptProvenance: jsonb("prompt_provenance").notNull(),
    referenceProvenance: jsonb("reference_provenance").notNull(),
    outputHash: text("output_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("content_generation_records_target_unique").on(table.targetId),
  ],
);

export const contentValidationResults = pgTable(
  "content_validation_results",
  {
    id: uuid("id").primaryKey(),
    kind: contentKind("kind").notNull(),
    targetId: uuid("target_id").notNull(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => accounts.id),
    findings: jsonb("findings").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("content_validation_results_target_idx").on(table.targetId),
  ],
);

export const contentReviewRecords = pgTable(
  "content_review_records",
  {
    id: uuid("id").primaryKey(),
    kind: contentKind("kind").notNull(),
    targetId: uuid("target_id").notNull(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => accounts.id),
    decision: contentReviewDecision("decision").notNull(),
    validationResultId: uuid("validation_result_id").references(
      () => contentValidationResults.id,
    ),
    reason: text("reason"),
    findings: jsonb("findings").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("content_review_records_target_idx").on(table.targetId)],
);

export const contentPhonePreviewRecords = pgTable(
  "content_phone_preview_records",
  {
    id: uuid("id").primaryKey(),
    targetId: uuid("target_id").notNull(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => accounts.id),
    viewportWidth: integer("viewport_width").notNull(),
    successful: boolean("successful").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "content_phone_preview_width_check",
      sql`${table.viewportWidth} = 375`,
    ),
    check(
      "content_phone_preview_success_check",
      sql`${table.successful} = true`,
    ),
    index("content_phone_preview_target_idx").on(table.targetId),
  ],
);

export const practiceSetStatus = pgEnum("practice_set_status", [
  "published",
  "retired",
]);
export const practiceSets = pgTable(
  "practice_sets",
  {
    id: uuid("id").primaryKey(),
    status: practiceSetStatus("status").notNull().default("published"),
    title: text("title").notNull(),
    paper: curriculumPaper("paper").notNull(),
    part: text("part").notNull(),
    estimatedDurationSeconds: integer("estimated_duration_seconds").notNull(),
    primaryTargetIds: jsonb("primary_target_ids").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => accounts.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("practice_sets_part_check", sql`${table.part} ~ '^[1-5]$'`),
    check("practice_sets_title_check", sql`${table.title} = btrim(${table.title}) AND length(${table.title}) BETWEEN 1 AND 120`),
    check(
      "practice_sets_duration_check",
      sql`${table.estimatedDurationSeconds} BETWEEN 300 AND 600`,
    ),
  ],
);

export const practiceSetAuditEvents = pgTable(
  "practice_set_audit_events",
  {
    id: uuid("id").primaryKey(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => accounts.id),
    action: text("action").notNull(),
    practiceSetId: uuid("practice_set_id")
      .notNull()
      .references(() => practiceSets.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("practice_set_audit_events_set_idx").on(table.practiceSetId),
  ],
);

export const practiceSetItems = pgTable(
  "practice_set_items",
  {
    id: uuid("id").primaryKey(),
    practiceSetId: uuid("practice_set_id")
      .notNull()
      .references(() => practiceSets.id),
    position: integer("position").notNull(),
    questionVersionId: uuid("question_version_id")
      .notNull()
      .references(() => questionDrafts.id),
    engine: curriculumEngine("engine").notNull(),
    renderedPrompt: text("rendered_prompt").notNull(),
    renderedOptions: jsonb("rendered_options").notNull(),
    answerPolicy: jsonb("answer_policy").notNull(),
    feedback: jsonb("feedback").notNull(),
    tags: jsonb("tags").notNull(),
    accessibilityMetadata: jsonb("accessibility_metadata").notNull(),
    provenance: jsonb("provenance").notNull(),
  },
  (table) => [
    unique("practice_set_items_position_unique").on(
      table.practiceSetId,
      table.position,
    ),
  ],
);

export const practiceSetItemMedia = pgTable("practice_set_item_media", {
  id: uuid("id").primaryKey(),
  practiceSetItemId: uuid("practice_set_item_id")
    .notNull()
    .references(() => practiceSetItems.id),
  mediaVersionId: uuid("media_version_id")
    .notNull()
    .references(() => mediaDrafts.id),
  mediaType: text("media_type").notNull(),
  objectVersion: text("object_version").notNull(),
  contentHash: text("content_hash").notNull(),
  accessibilityMetadata: jsonb("accessibility_metadata").notNull(),
  provenance: jsonb("provenance").notNull(),
});

export const questionVersionMedia = pgTable(
  "question_version_media",
  {
    id: uuid("id").primaryKey(),
    questionVersionId: uuid("question_version_id")
      .notNull()
      .references(() => questionDrafts.id),
    mediaVersionId: uuid("media_version_id")
      .notNull()
      .references(() => mediaDrafts.id),
    position: integer("position").notNull(),
  },
  (table) => [
    unique("question_version_media_question_media_unique").on(
      table.questionVersionId,
      table.mediaVersionId,
    ),
    unique("question_version_media_question_position_unique").on(
      table.questionVersionId,
      table.position,
    ),
  ],
);
