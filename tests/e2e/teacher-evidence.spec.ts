import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/cambridgeyle_e2e";
const migrations = [
  "0000_initial_baseline.sql", "0001_identity.sql", "0002_canonical_account_email.sql", "0003_curriculum.sql", "0004_curriculum_policy_hardening.sql", "0005_curriculum_controlled_policy.sql", "0006_curriculum_target_approval.sql", "0007_answer_policy_guidance_reference.sql", "0008_content_drafts.sql", "0009_content_review_workflow.sql", "0010_content_review_trigger_fix.sql", "0011_content_review_integrity.sql", "0012_content_rejection_approval_guard.sql", "0013_content_approval_evidence_guard.sql", "0014_publish_immutable_practice_sets.sql", "0015_publish_immutable_practice_set_schema.sql", "0016_question_version_media.sql", "0017_learner_practice_selection.sql", "0018_practice_attempt_snapshot_metadata.sql", "0019_practice_attempt_responses_and_playback.sql", "0020_practice_attempt_submission_review.sql", "0021_teacher_evidence_projection.sql", "0022_teacher_evidence_filter_drilldown.sql", "0023_content_evidence_dimensions.sql", "0024_teacher_evidence_resolution.sql",
];
const fixture = {
  teacherId: crypto.randomUUID(),
  academicLeadId: crypto.randomUUID(),
  adminId: crypto.randomUUID(),
  learnerId: crypto.randomUUID(),
  targetId: crypto.randomUUID(),
  setId: crypto.randomUUID(),
  attemptId: crypto.randomUUID(),
  reviewItemId: crypto.randomUUID(),
  learnerName: `Alex Learner ${crypto.randomUUID()}`,
  email: `teacher-evidence-${crypto.randomUUID()}@example.test`,
  sessionToken: crypto.randomUUID(),
  academicLeadSessionToken: crypto.randomUUID(),
  adminSessionToken: crypto.randomUUID(),
};

test.beforeAll(async () => {
  if (!new URL(databaseUrl).pathname.endsWith("_e2e")) throw new Error("Teacher evidence E2E requires a dedicated *_e2e database.");
  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    // The E2E database may already contain an incomplete migration state. Reset its
    // disposable schema rather than inferring migration state from one table.
    await sql.unsafe('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
    for (const file of migrations) await sql.unsafe(await readFile(`db/migrations/${file}`, "utf8"));
    const guidanceId = crypto.randomUUID();
    const policyId = crypto.randomUUID();
    const policyVersionId = crypto.randomUUID();
    const questionId = crypto.randomUUID();
    const itemId = crypto.randomUUID();
    const submittedAt = new Date();
    await sql.begin(async (transaction) => {
      await transaction`INSERT INTO accounts (id, email, canonical_email, display_name, role) VALUES (${fixture.teacherId}, ${fixture.email}, ${fixture.email}, 'Evidence Teacher', 'teacher'), (${fixture.academicLeadId}, ${`lead-${fixture.academicLeadId}@example.test`}, ${`lead-${fixture.academicLeadId}@example.test`}, 'Evidence Lead', 'academic_lead'), (${fixture.adminId}, ${`admin-${fixture.adminId}@example.test`}, ${`admin-${fixture.adminId}@example.test`}, 'Evidence Admin', 'admin'), (${fixture.learnerId}, ${`learner-${fixture.learnerId}@example.test`}, ${`learner-${fixture.learnerId}@example.test`}, ${fixture.learnerName}, 'learner')`;
      await transaction`INSERT INTO sessions (id, account_id, verifier_hash, expires_at) VALUES (${crypto.randomUUID()}, ${fixture.teacherId}, ${createHash("sha256").update(fixture.sessionToken).digest("hex")}, ${new Date(Date.now() + 60 * 60 * 1000)})`;
      await transaction`INSERT INTO sessions (id, account_id, verifier_hash, expires_at) VALUES (${crypto.randomUUID()}, ${fixture.academicLeadId}, ${createHash("sha256").update(fixture.academicLeadSessionToken).digest("hex")}, ${new Date(Date.now() + 60 * 60 * 1000)}), (${crypto.randomUUID()}, ${fixture.adminId}, ${createHash("sha256").update(fixture.adminSessionToken).digest("hex")}, ${new Date(Date.now() + 60 * 60 * 1000)})`;
      await transaction`INSERT INTO curriculum_targets (id, canonical_id, category, guidance, created_by) VALUES (${fixture.targetId}, ${`animals-${fixture.targetId}`}, 'vocabulary', 'Animal vocabulary', ${fixture.teacherId})`;
      await transaction`INSERT INTO curriculum_guidance (id, paper, part, engine, topic, task_format, max_words, max_options, approved_names, approved_numbers) VALUES (${guidanceId}, 'listening', 1, 'picture_true_false', ${`Animals ${guidanceId}`}, 'Picture true false', 10, 2, '[]'::jsonb, '[]'::jsonb)`;
      await transaction`INSERT INTO answer_policies (id, canonical_id, target_id, guidance_id, paper, part, engine) VALUES (${policyId}, ${`animals-policy-${policyId}`}, ${fixture.targetId}, ${guidanceId}, 'listening', 1, 'picture_true_false')`;
      await transaction`INSERT INTO answer_policy_versions (id, policy_id, version, input_kind, canonical_answer, accepted_answers, normalisation, max_words, teacher_review_if_uncertain, created_by) VALUES (${policyVersionId}, ${policyId}, 1, 'boolean', 'true'::jsonb, '[]'::jsonb, '{}'::jsonb, 1, false, ${fixture.teacherId})`;
      await transaction`INSERT INTO question_drafts (id, status, origin, paper, part, engine, primary_target_id, supporting_target_ids, topic_ids, guidance_id, estimated_duration_seconds, accessibility_metadata, provenance, created_by, answer_policy_version_id, prompt, options) VALUES (${questionId}, 'draft', 'manual', 'listening', '1', 'picture_true_false', ${fixture.targetId}, '[]'::jsonb, ${JSON.stringify([fixture.targetId])}::jsonb, ${guidanceId}, '60', '{"altText":"A cat"}'::jsonb, '{"source":"Original","rightsReference":"Owned"}'::jsonb, ${fixture.teacherId}, ${policyVersionId}, 'A cat', '["true","false"]'::jsonb)`;
      await transaction`INSERT INTO practice_sets (id, title, paper, part, estimated_duration_seconds, primary_target_ids, created_by) VALUES (${fixture.setId}, 'Animal listening', 'listening', '1', 300, ${JSON.stringify([fixture.targetId])}::jsonb, ${fixture.teacherId})`;
      await transaction`INSERT INTO practice_set_items (id, practice_set_id, position, question_version_id, engine, rendered_prompt, rendered_options, answer_policy, feedback, tags, accessibility_metadata, provenance) VALUES (${itemId}, ${fixture.setId}, 1, ${questionId}, 'picture_true_false', 'A cat', '["true","false"]'::jsonb, '{}'::jsonb, '{}'::jsonb, ${JSON.stringify({ primaryTargetId: fixture.targetId })}::jsonb, '{"altText":"A cat"}'::jsonb, '{"source":"Original","rightsReference":"Owned"}'::jsonb)`;
      await transaction`INSERT INTO practice_attempts (id, learner_id, practice_set_id, practice_set_version_id, status, submitted_at, last_saved_at, created_at, finalisation_key, submitted_title, submitted_presentation, expected_review_item_count, review_snapshot_items, final_timing, playback_snapshot) VALUES (${fixture.attemptId}, ${fixture.learnerId}, ${fixture.setId}, ${fixture.setId}, 'submitted', ${submittedAt}, ${submittedAt}, ${submittedAt}, ${crypto.randomUUID()}, 'Animal listening', '{"paper":"listening","part":"1"}'::jsonb, 1, ${JSON.stringify([{ id: itemId, position: 1 }])}::jsonb, ${JSON.stringify({ startedAt: submittedAt.toISOString(), lastSavedAt: submittedAt.toISOString(), submittedAt: submittedAt.toISOString() })}::jsonb, ${JSON.stringify([{ itemId, mediaId: "audio-1", playedAt: submittedAt.toISOString() }])}::jsonb)`;
      await transaction`INSERT INTO practice_attempt_review_items (id, attempt_id, practice_set_item_id, position, outcome, evidence_label, approved_answer, approved_answer_label, presentation, answer_policy_version, curriculum_tags) VALUES (${fixture.reviewItemId}, ${fixture.attemptId}, ${itemId}, 1, 'needs_teacher_review', 'not_assessed_yet', 'true'::jsonb, 'True', '{}'::jsonb, 'fixture', ${transaction.json({ dimensions: { topic: [`Animals ${guidanceId}`] }, evidenceTargets: [{ id: fixture.targetId, label: "animals" }] })})`;
      await transaction`INSERT INTO submitted_evidence_facts (id, attempt_id, review_item_id, learner_id, practice_set_id, paper, part, language_target_id, language_target, automatic_outcome, dimensions, submitted_at) SELECT ${crypto.randomUUID()}, ${fixture.attemptId}, ${fixture.reviewItemId}, ${fixture.learnerId}, ${fixture.setId}, 'listening', '1', ${fixture.targetId}, 'animals', 'needs_teacher_review', ${transaction.json({ topic: [`Animals ${guidanceId}`] })}, submitted_at FROM practice_attempts WHERE id = ${fixture.attemptId}`;
    });
  } finally {
    await sql.end();
  }
});

test("active staff can inspect seeded submitted evidence and learner detail on a narrow screen", async ({ context, page }) => {
  await context.addCookies([{ name: "cambridgeyle_session", value: fixture.sessionToken, url: "http://127.0.0.1:3100", httpOnly: true, secure: false, sameSite: "Lax" }]);
  await page.goto("/teacher");
  await expect(page.getByRole("heading", { name: "Centre evidence and actionable gaps" })).toBeVisible();
  await expect(page.getByRole("heading", { name: fixture.learnerName })).toBeVisible();
  await page.getByLabel("Topic").fill(`Animals ${fixture.targetId}`);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("No completed practice yet for this selection.")).toBeVisible();
  await page.goto("/teacher");
  const learnerRow = page.locator(`#learner-${fixture.learnerId}`);
  await expect(learnerRow.getByText("Not assessed yet: complete more practice for Listening Part 1: animals.")).toBeVisible();
  await page.setViewportSize({ width: 375, height: 800 });
  const detail = page.getByRole("link", { name: `Open evidence detail for ${fixture.learnerName}` });
  await expect(detail).toHaveCSS("min-height", "48px");
  await expect(page.locator(".evidence-rows")).toHaveCSS("grid-template-columns", "309px");
  await detail.click();
  await expect(page).toHaveURL(new RegExp(`/teacher\\?learner=${fixture.learnerId}$`));
  await expect(page.getByRole("heading", { name: "Learner evidence detail" })).toBeVisible();
  await expect(page.getByRole("heading", { name: fixture.learnerName })).toBeVisible();
  await expect(page.getByText("Response: No response")).toBeVisible();
  await expect(page.getByText(`Started: ${fixture.attemptId}`, { exact: false })).toHaveCount(0);
  await expect(page.getByText(/Started: .*Last saved: .*Submitted:/)).toBeVisible();
  await expect(page.getByText(/Played: .*T/)).toBeVisible();
});

test("academic leads and admins resolve and retry stale uncertain outcomes", async ({ browser }) => {
  const leadContext = await browser.newContext();
  const adminContext = await browser.newContext();
  const leadPage = await leadContext.newPage();
  const adminPage = await adminContext.newPage();
  try {
    await leadContext.addCookies([{ name: "cambridgeyle_session", value: fixture.academicLeadSessionToken, url: "http://127.0.0.1:3100", httpOnly: true, secure: false, sameSite: "Lax" }]);
    await adminContext.addCookies([{ name: "cambridgeyle_session", value: fixture.adminSessionToken, url: "http://127.0.0.1:3100", httpOnly: true, secure: false, sameSite: "Lax" }]);
    await Promise.all([leadPage.goto(`/teacher?learner=${fixture.learnerId}`), adminPage.goto(`/teacher?learner=${fixture.learnerId}`)]);
    await expect(leadPage.getByRole("form", { name: "Resolve uncertain outcome" })).toBeVisible();
    await expect(adminPage.getByRole("form", { name: "Resolve uncertain outcome" })).toBeVisible();
    await leadPage.getByLabel("Reason").fill("Accepted by academic lead");
    await leadPage.getByRole("button", { name: "Save resolution" }).click();
    await expect(leadPage.getByText("Effective outcome: correct (resolution 1)")).toBeVisible();
    await expect(leadPage.getByRole("form", { name: "Correct resolved outcome" })).toBeVisible();
    await adminPage.getByLabel("Reason").fill("Admin correction after review");
    await adminPage.getByRole("button", { name: "Save resolution" }).click();
    await expect(adminPage.getByText("This item was updated by someone else. Refresh and try again.")).toBeVisible();
    await expect(adminPage.getByRole("form", { name: "Correct resolved outcome" })).toBeVisible();
    await adminPage.getByLabel("Effective outcome").selectOption("incorrect");
    await adminPage.getByLabel("Reason").fill("Admin correction after refresh");
    await adminPage.getByRole("button", { name: "Save correction" }).click();
    await expect(adminPage.getByText("Effective outcome: incorrect (resolution 2)")).toBeVisible();
  } finally {
    await leadContext.close();
    await adminContext.close();
  }
});
