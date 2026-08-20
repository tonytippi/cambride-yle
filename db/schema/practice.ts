import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { accounts } from "./identity";
import { practiceSets } from "./content";

export const practiceAttemptStatus = pgEnum("practice_attempt_status", ["open", "submitted"]);
export const practiceEvidenceLabel = pgEnum("practice_evidence_label", ["secure", "building", "needs_practice", "not_assessed_yet"]);

export const practiceAttempts = pgTable("practice_attempts", {
  id: uuid("id").primaryKey(),
  learnerId: uuid("learner_id").notNull().references(() => accounts.id),
  practiceSetId: uuid("practice_set_id").notNull().references(() => practiceSets.id),
  practiceSetVersionId: uuid("practice_set_version_id").notNull().references(() => practiceSets.id),
  revision: integer("revision").notNull().default(0),
  status: practiceAttemptStatus("status").notNull().default("open"),
  lastSavedAt: timestamp("last_saved_at", { withTimezone: true }).notNull().defaultNow(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("practice_attempts_lifecycle_check", sql`((${table.status} = 'open' AND ${table.submittedAt} IS NULL) OR (${table.status} = 'submitted' AND ${table.submittedAt} IS NOT NULL)) AND ${table.lastSavedAt} >= ${table.createdAt} AND (${table.submittedAt} IS NULL OR ${table.submittedAt} >= ${table.createdAt}) AND ${table.practiceSetVersionId} = ${table.practiceSetId} AND ${table.revision} >= 0`),
  index("practice_attempts_learner_set_idx").on(table.learnerId, table.practiceSetId, table.status),
  unique("practice_attempts_id_set_unique").on(table.id, table.practiceSetId),
  uniqueIndex("practice_attempts_one_open_per_learner_set").on(table.learnerId, table.practiceSetId).where(sql`${table.status} = 'open'`),
]);

export const practiceAttemptEvidence = pgTable("practice_attempt_evidence", {
  id: uuid("id").primaryKey(),
  attemptId: uuid("attempt_id").notNull(),
  practiceSetId: uuid("practice_set_id").notNull().references(() => practiceSets.id),
  practiceAreaId: text("practice_area_id").notNull(),
  label: practiceEvidenceLabel("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("practice_attempt_evidence_attempt_area_unique").on(table.attemptId, table.practiceAreaId),
  foreignKey({ columns: [table.attemptId, table.practiceSetId], foreignColumns: [practiceAttempts.id, practiceAttempts.practiceSetId], name: "practice_attempt_evidence_attempt_set_fk" }),
  index("practice_attempt_evidence_set_idx").on(table.practiceSetId),
]);

export const practiceRecommendationAudits = pgTable("practice_recommendation_audits", {
  id: uuid("id").primaryKey(),
  learnerId: uuid("learner_id").notNull().references(() => accounts.id),
  version: text("version").notNull(),
  displayedSetIds: jsonb("displayed_set_ids").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("practice_recommendation_audits_learner_idx").on(table.learnerId)]);
