import { boolean, check, index, integer, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { accounts } from "./identity";

export const curriculumLevel = pgEnum("curriculum_level", ["starters"]);
export const curriculumCategory = pgEnum("curriculum_category", ["vocabulary", "grammar", "topic", "language_target"]);
export const curriculumPaper = pgEnum("curriculum_paper", ["listening", "reading_writing"]);
export const policyInputKind = pgEnum("policy_input_kind", ["choice", "boolean", "yes_no", "number", "name", "word", "assignment"]);
export const curriculumEngine = pgEnum("curriculum_engine", ["picture_true_false", "picture_yes_no", "audio_picture_choice", "audio_note_taking", "word_bank_cloze"]);

export const curriculumTargets = pgTable("curriculum_targets", {
  id: uuid("id").primaryKey(), canonicalId: text("canonical_id").notNull(), category: curriculumCategory("category").notNull(), level: curriculumLevel("level").notNull().default("starters"), guidance: text("guidance").notNull(), isApproved: boolean("is_approved").notNull().default(false), createdBy: uuid("created_by").notNull().references(() => accounts.id), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [unique("curriculum_targets_canonical_id_unique").on(table.canonicalId)]);

export const curriculumGuidance = pgTable("curriculum_guidance", {
  id: uuid("id").primaryKey(), paper: curriculumPaper("paper").notNull(), part: integer("part").notNull(), engine: curriculumEngine("engine").notNull(), topic: text("topic").notNull(), taskFormat: text("task_format").notNull(), maxWords: integer("max_words").notNull(), maxOptions: integer("max_options").notNull(), approvedNames: jsonb("approved_names").notNull(), approvedNumbers: jsonb("approved_numbers").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [check("curriculum_guidance_part_check", sql`${table.part} BETWEEN 1 AND 5`), check("curriculum_guidance_limits_check", sql`${table.maxWords} > 0 AND ${table.maxOptions} > 0`), unique("curriculum_guidance_record_unique").on(table.paper, table.part, table.engine, table.topic, table.taskFormat)]);

export const answerPolicies = pgTable("answer_policies", {
  id: uuid("id").primaryKey(), canonicalId: text("canonical_id").notNull(), targetId: uuid("target_id").notNull().references(() => curriculumTargets.id), guidanceId: uuid("guidance_id").notNull().references(() => curriculumGuidance.id), paper: curriculumPaper("paper").notNull(), part: integer("part").notNull(), engine: curriculumEngine("engine").notNull(), currentVersionId: uuid("current_version_id"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [unique("answer_policies_canonical_id_unique").on(table.canonicalId)]);

export const answerPolicyVersions = pgTable("answer_policy_versions", {
  id: uuid("id").primaryKey(), policyId: uuid("policy_id").notNull().references(() => answerPolicies.id), version: integer("version").notNull(), inputKind: policyInputKind("input_kind").notNull(), canonicalAnswer: jsonb("canonical_answer").notNull(), acceptedAnswers: jsonb("accepted_answers").notNull(), normalisation: jsonb("normalisation").notNull(), maxWords: integer("max_words").notNull(), teacherReviewIfUncertain: boolean("teacher_review_if_uncertain").notNull(), createdBy: uuid("created_by").notNull().references(() => accounts.id), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [unique("answer_policy_versions_policy_version_unique").on(table.policyId, table.version), unique("answer_policy_versions_id_policy_unique").on(table.id, table.policyId), check("answer_policy_versions_max_words_check", sql`${table.maxWords} > 0`)]);

export const policyConformanceVectors = pgTable("policy_conformance_vectors", {
  id: uuid("id").primaryKey(), policyVersionId: uuid("policy_version_id").notNull().references(() => answerPolicyVersions.id), response: jsonb("response").notNull(), expectedOutcome: text("expected_outcome").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [check("policy_conformance_vectors_outcome_check", sql`${table.expectedOutcome} IN ('correct', 'incorrect', 'needs_teacher_review')`), index("policy_conformance_vectors_version_idx").on(table.policyVersionId)]);

export const curriculumAuditEvents = pgTable("curriculum_audit_events", {
  id: uuid("id").primaryKey(), actorId: uuid("actor_id").notNull().references(() => accounts.id), action: text("action").notNull(), targetId: uuid("target_id").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("curriculum_audit_events_target_idx").on(table.targetId)]);
