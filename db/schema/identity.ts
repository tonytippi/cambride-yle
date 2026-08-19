import { type AnyPgColumn, check, index, integer, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const accountRole = pgEnum("account_role", ["learner", "teacher", "academic_lead", "admin"]);
export const accountStatus = pgEnum("account_status", ["active", "deactivated"]);

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: accountRole("role").notNull(),
  status: accountStatus("status").notNull().default("active"),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
  deactivatedBy: uuid("deactivated_by").references((): AnyPgColumn => accounts.id)
}, (table) => [check("accounts_lifecycle_check", sql`(${table.status} = 'active' AND ${table.deactivatedAt} IS NULL) OR (${table.status} = 'deactivated' AND ${table.deactivatedAt} IS NOT NULL)`)]);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  verifierHash: text("verifier_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true })
}, (table) => [index("sessions_account_id_idx").on(table.accountId), index("sessions_active_idx").on(table.expiresAt)]);

export const oidcIdentities = pgTable("oidc_identities", {
  provider: text("provider").notNull(),
  subject: text("subject").notNull(),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [primaryKey({ columns: [table.provider, table.subject] }), index("oidc_identities_account_id_idx").on(table.accountId)]);

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey(),
  actorId: uuid("actor_id").references(() => accounts.id),
  action: text("action").notNull(),
  targetId: uuid("target_id").references(() => accounts.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const signInThrottles = pgTable("sign_in_throttles", {
  keyHash: text("key_hash").primaryKey(),
  failures: integer("failures").notNull().default(0),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
  blockedUntil: timestamp("blocked_until", { withTimezone: true })
});
