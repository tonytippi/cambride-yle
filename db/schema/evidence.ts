import { check, foreignKey, index, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { practiceAttempts, practiceAttemptReviewItems } from "./practice";
import { practiceSets } from "./content";
import { curriculumTargets } from "./curriculum";

export const evidenceOutcome = pgEnum("evidence_outcome", ["correct", "incorrect", "unanswered", "needs_teacher_review"]);

// These values are copied from submitted review snapshots and never re-read from editable content.
export const submittedEvidenceFacts = pgTable("submitted_evidence_facts", {
  id: uuid("id").primaryKey(),
  attemptId: uuid("attempt_id").notNull(),
  reviewItemId: uuid("review_item_id").notNull(),
  learnerId: uuid("learner_id").notNull(),
  practiceSetId: uuid("practice_set_id").notNull(),
  paper: text("paper").notNull(),
  part: text("part").notNull(),
  languageTargetId: uuid("language_target_id").notNull(),
  languageTarget: text("language_target").notNull(),
  automaticOutcome: evidenceOutcome("automatic_outcome").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("submitted_evidence_facts_review_target_unique").on(table.reviewItemId, table.languageTargetId),
  check("submitted_evidence_facts_paper_check", sql`${table.paper} IN ('listening', 'reading_writing')`),
  foreignKey({ columns: [table.attemptId, table.learnerId, table.practiceSetId], foreignColumns: [practiceAttempts.id, practiceAttempts.learnerId, practiceAttempts.practiceSetId], name: "submitted_evidence_facts_attempt_scope_fk" }),
  foreignKey({ columns: [table.reviewItemId, table.attemptId], foreignColumns: [practiceAttemptReviewItems.id, practiceAttemptReviewItems.attemptId], name: "submitted_evidence_facts_review_attempt_fk" }),
  foreignKey({ columns: [table.practiceSetId], foreignColumns: [practiceSets.id], name: "submitted_evidence_facts_set_fk" }),
  foreignKey({ columns: [table.languageTargetId], foreignColumns: [curriculumTargets.id], name: "submitted_evidence_facts_target_fk" }),
  index("submitted_evidence_facts_latest_idx").on(table.learnerId, table.practiceSetId, table.submittedAt),
  index("submitted_evidence_facts_target_idx").on(table.paper, table.part, table.languageTargetId, table.submittedAt),
]);
