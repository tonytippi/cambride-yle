import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import argon2 from "argon2";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/cambridgeyle_e2e";
const migrations = [
  "0000_initial_baseline.sql", "0001_identity.sql", "0002_canonical_account_email.sql", "0003_curriculum.sql", "0004_curriculum_policy_hardening.sql", "0005_curriculum_controlled_policy.sql", "0006_curriculum_target_approval.sql", "0007_answer_policy_guidance_reference.sql", "0008_content_drafts.sql", "0009_content_review_workflow.sql", "0010_content_review_trigger_fix.sql", "0011_content_review_integrity.sql", "0012_content_rejection_approval_guard.sql", "0013_content_approval_evidence_guard.sql", "0014_publish_immutable_practice_sets.sql", "0015_publish_immutable_practice_set_schema.sql", "0016_question_version_media.sql", "0017_learner_practice_selection.sql", "0018_practice_attempt_snapshot_metadata.sql", "0019_practice_attempt_responses_and_playback.sql", "0020_practice_attempt_submission_review.sql", "0021_teacher_evidence_projection.sql", "0022_teacher_evidence_filter_drilldown.sql", "0023_content_evidence_dimensions.sql", "0024_teacher_evidence_resolution.sql", "0025_practice_set_composition_trigger_fix.sql", "0026_content_history_trigger_fix.sql",
];
const fixture = {
  teacherId: crypto.randomUUID(),
  academicLeadId: crypto.randomUUID(),
  adminId: crypto.randomUUID(),
  learnerId: crypto.randomUUID(),
  emptyLearnerId: crypto.randomUUID(),
  clozeLearnerId: crypto.randomUUID(),
  targetId: crypto.randomUUID(),
  setId: crypto.randomUUID(),
  clozeSetId: crypto.randomUUID(),
  mediaId: crypto.randomUUID(),
  mediaVersionId: crypto.randomUUID(),
  attemptId: crypto.randomUUID(),
  reviewItemId: crypto.randomUUID(),
  learnerName: `Alex Learner ${crypto.randomUUID()}`,
  emptyLearnerName: `Sam Learner ${crypto.randomUUID()}`,
  email: `teacher-evidence-${crypto.randomUUID()}@example.test`,
  sessionToken: crypto.randomUUID(),
  academicLeadSessionToken: crypto.randomUUID(),
  adminSessionToken: crypto.randomUUID(),
  learnerSessionToken: crypto.randomUUID(),
  clozeLearnerSessionToken: crypto.randomUUID(),
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
    const clozeItemId = crypto.randomUUID();
    const submittedAt = new Date();
    await sql.begin(async (transaction) => {
      await transaction`INSERT INTO accounts (id, email, canonical_email, display_name, role) VALUES (${fixture.teacherId}, ${fixture.email}, ${fixture.email}, 'Evidence Teacher', 'teacher'), (${fixture.academicLeadId}, ${`lead-${fixture.academicLeadId}@example.test`}, ${`lead-${fixture.academicLeadId}@example.test`}, 'Evidence Lead', 'academic_lead'), (${fixture.adminId}, ${`admin-${fixture.adminId}@example.test`}, ${`admin-${fixture.adminId}@example.test`}, 'Evidence Admin', 'admin'), (${fixture.learnerId}, ${`learner-${fixture.learnerId}@example.test`}, ${`learner-${fixture.learnerId}@example.test`}, ${fixture.learnerName}, 'learner'), (${fixture.emptyLearnerId}, ${`empty-${fixture.emptyLearnerId}@example.test`}, ${`empty-${fixture.emptyLearnerId}@example.test`}, ${fixture.emptyLearnerName}, 'learner'), (${fixture.clozeLearnerId}, ${`cloze-${fixture.clozeLearnerId}@example.test`}, ${`cloze-${fixture.clozeLearnerId}@example.test`}, 'Cloze Learner', 'learner')`;
      await transaction`INSERT INTO sessions (id, account_id, verifier_hash, expires_at) VALUES (${crypto.randomUUID()}, ${fixture.teacherId}, ${createHash("sha256").update(fixture.sessionToken).digest("hex")}, ${new Date(Date.now() + 60 * 60 * 1000)})`;
      await transaction`INSERT INTO sessions (id, account_id, verifier_hash, expires_at) VALUES (${crypto.randomUUID()}, ${fixture.academicLeadId}, ${createHash("sha256").update(fixture.academicLeadSessionToken).digest("hex")}, ${new Date(Date.now() + 60 * 60 * 1000)}), (${crypto.randomUUID()}, ${fixture.adminId}, ${createHash("sha256").update(fixture.adminSessionToken).digest("hex")}, ${new Date(Date.now() + 60 * 60 * 1000)})`;
      await transaction`INSERT INTO sessions (id, account_id, verifier_hash, expires_at) VALUES (${crypto.randomUUID()}, ${fixture.learnerId}, ${createHash("sha256").update(fixture.learnerSessionToken).digest("hex")}, ${new Date(Date.now() + 60 * 60 * 1000)})`;
      await transaction`INSERT INTO sessions (id, account_id, verifier_hash, expires_at) VALUES (${crypto.randomUUID()}, ${fixture.clozeLearnerId}, ${createHash("sha256").update(fixture.clozeLearnerSessionToken).digest("hex")}, ${new Date(Date.now() + 60 * 60 * 1000)})`;
      await transaction`INSERT INTO curriculum_targets (id, canonical_id, category, guidance, created_by) VALUES (${fixture.targetId}, ${`animals-${fixture.targetId}`}, 'vocabulary', 'Animal vocabulary', ${fixture.teacherId})`;
      await transaction`INSERT INTO curriculum_guidance (id, paper, part, engine, topic, task_format, max_words, max_options, approved_names, approved_numbers) VALUES (${guidanceId}, 'listening', 1, 'picture_true_false', ${`Animals ${guidanceId}`}, 'Picture true false', 10, 2, '[]'::jsonb, '[]'::jsonb)`;
      await transaction`INSERT INTO answer_policies (id, canonical_id, target_id, guidance_id, paper, part, engine) VALUES (${policyId}, ${`animals-policy-${policyId}`}, ${fixture.targetId}, ${guidanceId}, 'listening', 1, 'picture_true_false')`;
      await transaction`INSERT INTO answer_policy_versions (id, policy_id, version, input_kind, canonical_answer, accepted_answers, normalisation, max_words, teacher_review_if_uncertain, created_by) VALUES (${policyVersionId}, ${policyId}, 1, 'boolean', 'true'::jsonb, '[]'::jsonb, '{}'::jsonb, 1, false, ${fixture.teacherId})`;
      await transaction`INSERT INTO question_drafts (id, status, origin, paper, part, engine, primary_target_id, supporting_target_ids, topic_ids, guidance_id, estimated_duration_seconds, accessibility_metadata, provenance, created_by, answer_policy_version_id, prompt, options) VALUES (${questionId}, 'published', 'manual', 'listening', '1', 'picture_true_false', ${fixture.targetId}, '[]'::jsonb, ${JSON.stringify([fixture.targetId])}::jsonb, ${guidanceId}, '60', '{"altText":"A cat"}'::jsonb, '{"source":"Original","rightsReference":"Owned"}'::jsonb, ${fixture.teacherId}, ${policyVersionId}, 'A cat', '["true","false"]'::jsonb)`;
      await transaction`INSERT INTO media_drafts (id, status, origin, paper, part, engine, primary_target_id, supporting_target_ids, topic_ids, guidance_id, estimated_duration_seconds, accessibility_metadata, provenance, created_by, media_type, description) VALUES (${fixture.mediaVersionId}, 'published', 'manual', 'listening', '1', 'picture_true_false', ${fixture.targetId}, '[]'::jsonb, ${JSON.stringify([fixture.targetId])}::jsonb, ${guidanceId}, '60', '{"altText":"A cat"}'::jsonb, '{"source":"Original","rightsReference":"Owned"}'::jsonb, ${fixture.teacherId}, 'image', 'Owned E2E image')`;
      await transaction`INSERT INTO practice_sets (id, title, paper, part, estimated_duration_seconds, primary_target_ids, created_by) VALUES (${fixture.setId}, 'Animal listening', 'listening', '1', 300, ${JSON.stringify([fixture.targetId])}::jsonb, ${fixture.teacherId})`;
      await transaction`INSERT INTO practice_sets (id, title, paper, part, estimated_duration_seconds, primary_target_ids, created_by) VALUES (${fixture.clozeSetId}, 'Word bank practice', 'listening', '1', 300, ${JSON.stringify([fixture.targetId])}::jsonb, ${fixture.teacherId})`;
      await transaction`INSERT INTO practice_set_items (id, practice_set_id, position, question_version_id, engine, rendered_prompt, rendered_options, answer_policy, feedback, tags, accessibility_metadata, provenance) VALUES (${itemId}, ${fixture.setId}, 1, ${questionId}, 'picture_true_false', 'A cat', '["true","false"]'::jsonb, '{}'::jsonb, '{}'::jsonb, ${transaction.json({ primaryTargetId: fixture.targetId, guidanceId })}, '{"altText":"A cat"}'::jsonb, '{"source":"Original","rightsReference":"Owned"}'::jsonb)`;
      await transaction`INSERT INTO practice_set_items (id, practice_set_id, position, question_version_id, engine, rendered_prompt, rendered_options, answer_policy, feedback, tags, accessibility_metadata, provenance) VALUES (${clozeItemId}, ${fixture.clozeSetId}, 1, ${questionId}, 'word_bank_cloze', 'Choose cat.', '["cat","dog"]'::jsonb, ${transaction.json({ canonicalAnswer: "cat", acceptedAnswers: [], inputKind: "word", normalisation: { unicode: "NFC", locale: "en-GB", caseSensitive: false, trimWhitespace: true, normalizePunctuation: true, normalizeNumberForms: false }, maxWords: 1, teacherReviewIfUncertain: false, policyId })}, '{}'::jsonb, ${transaction.json({ primaryTargetId: fixture.targetId, guidanceId })}, '{"altText":"Word bank"}'::jsonb, '{"source":"Original","rightsReference":"Owned"}'::jsonb)`;
      await transaction`INSERT INTO practice_set_item_media (id, practice_set_item_id, media_version_id, media_type, object_version, content_hash, accessibility_metadata, provenance) VALUES (${fixture.mediaId}, ${itemId}, ${fixture.mediaVersionId}, 'image', 'owned-e2e-image.png', 'owned-e2e-image', '{"altText":"A cat"}'::jsonb, '{"source":"Original","rightsReference":"Owned"}'::jsonb)`;
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

test("published practice composition rejects later media associations", async () => {
  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    await expect(sql`INSERT INTO practice_set_item_media (id, practice_set_item_id, media_version_id, media_type, object_version, content_hash, accessibility_metadata, provenance) VALUES (${crypto.randomUUID()}, ${fixture.setId}, ${fixture.mediaVersionId}, 'image', 'owned-e2e-image.png', 'owned-e2e-image', '{"altText":"A cat"}'::jsonb, '{"source":"Original","rightsReference":"Owned"}'::jsonb)`).rejects.toThrow(/PRACTICE_SET_COMPOSITION_IMMUTABLE/);
  } finally {
    await sql.end();
  }
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

test("an admin reviews learner evidence before named deactivation retains submitted records and revokes access", async ({ context, page }) => {
  await context.addCookies([{ name: "cambridgeyle_session", value: fixture.adminSessionToken, url: "http://127.0.0.1:3100", httpOnly: true, secure: false, sameSite: "Lax" }]);
  await page.goto(`/admin/accounts/${fixture.learnerId}`);
  await page.getByRole("link", { name: "Review practice evidence" }).click();
  await expect(page).toHaveURL(new RegExp(`/teacher\\?learner=${fixture.learnerId}$`));
  await expect(page.getByRole("heading", { name: "Learner evidence detail" })).toBeVisible();

  await page.goto(`/admin/accounts/${fixture.learnerId}`);
  await page.getByRole("button", { name: "Deactivate account" }).click();
  await page.getByLabel(`Type learner-${fixture.learnerId}@example.test to confirm`).fill(`learner-${fixture.learnerId}@example.test`);
  await page.locator("dialog").getByRole("button", { name: "Deactivate account", exact: true }).click();
  await expect(page.locator("dialog")).not.toBeVisible();

  const revokedContext = await context.browser()!.newContext();
  const revokedPage = await revokedContext.newPage();
  try {
    await revokedContext.addCookies([{ name: "cambridgeyle_session", value: fixture.learnerSessionToken, url: "http://127.0.0.1:3100", httpOnly: true, secure: false, sameSite: "Lax" }]);
    await revokedPage.goto(`/learner/practice/${fixture.setId}`);
    await expect(revokedPage).toHaveURL(/\/sign-in$/);
    await expect(revokedPage.getByRole("heading", { name: "Practice preparation" })).toHaveCount(0);
    const start = await revokedPage.request.post("/api/practice/start", { data: { setId: fixture.setId } });
    expect(start.status()).toBe(403);
    expect((await start.json()).error.code).toBe("FORBIDDEN");
  } finally {
    await revokedContext.close();
  }

  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    const [account] = await sql<{ status: string }[]>`SELECT status FROM accounts WHERE id = ${fixture.learnerId}`;
    const [session] = await sql<{ revoked_at: Date | null }[]>`SELECT revoked_at FROM sessions WHERE verifier_hash = ${createHash("sha256").update(fixture.learnerSessionToken).digest("hex")}`;
    const [attempt] = await sql<{ count: string }[]>`SELECT count(*) FROM practice_attempts WHERE learner_id = ${fixture.learnerId} AND status = 'submitted'`;
    const [openAttempt] = await sql<{ count: string }[]>`SELECT count(*) FROM practice_attempts WHERE learner_id = ${fixture.learnerId} AND practice_set_id = ${fixture.setId} AND status = 'open'`;
    const [evidence] = await sql<{ count: string }[]>`SELECT count(*) FROM submitted_evidence_facts WHERE learner_id = ${fixture.learnerId}`;
    const [audit] = await sql<{ action: string; target_id: string; target_scope: string | null; outcome: string | null }[]>`SELECT action, target_id, target_scope, outcome FROM audit_events WHERE action = 'EVIDENCE_READ' AND actor_id = ${fixture.adminId} AND target_id = ${fixture.learnerId} ORDER BY created_at DESC LIMIT 1`;
    expect(account?.status).toBe("deactivated");
    expect(session?.revoked_at).not.toBeNull();
    expect(attempt?.count).toBe("1");
    expect(openAttempt?.count).toBe("0");
    expect(evidence?.count).toBe("1");
    expect(audit).toEqual({ action: "EVIDENCE_READ", target_id: fixture.learnerId, target_scope: "LEARNER_DETAIL", outcome: "SUCCESS" });
  } finally {
    await sql.end();
  }
});

test("an admin provisions a learner who signs in and starts a ready published practice", async ({ browser, context, page }) => {
  const learnerEmail = `first-practice-${crypto.randomUUID()}@example.test`;
  const learnerName = `First Practice ${crypto.randomUUID()}`;
  const password = "temporary-password-123";
  await context.addCookies([{ name: "cambridgeyle_session", value: fixture.adminSessionToken, url: "http://127.0.0.1:3100", httpOnly: true, secure: false, sameSite: "Lax" }]);
  await page.goto("/admin");
  await page.getByLabel("Email").fill(learnerEmail);
  await page.getByLabel("Display name").fill(learnerName);
  await page.getByLabel("Role").selectOption("learner");
  await page.getByLabel("Temporary password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Account created.")).toBeVisible();

  const provisionedSql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    const [account] = await provisionedSql<{ role: string; status: string; password_hash: string }[]>`SELECT role, status, password_hash FROM accounts WHERE canonical_email = ${learnerEmail}`;
    expect(account).toMatchObject({ role: "learner", status: "active" });
    expect(await argon2.verify(account!.password_hash, password)).toBe(true);
  } finally {
    await provisionedSql.end();
  }

  const learnerContext = await browser.newContext();
  const learnerPage = await learnerContext.newPage();
  try {
    await learnerPage.goto("/sign-in");
    await learnerPage.getByLabel("Email").fill(learnerEmail);
    await learnerPage.getByLabel("Password").fill(password);
    await learnerPage.getByRole("button", { name: "Sign in" }).click();
    await expect(learnerPage).toHaveURL(/\/learner$/);
    await learnerPage.getByText("Animal listening").locator("..").getByRole("link", { name: "Start" }).click();
    await expect(learnerPage.getByText("Image").locator("..").getByText("Ready")).toBeVisible();
    await learnerPage.getByRole("button", { name: "Start" }).click();
    await expect(learnerPage).toHaveURL(new RegExp(`/learner/practice/${fixture.setId}/attempt/`));
    await expect(learnerPage.getByRole("heading", { name: "Animal listening" })).toBeVisible();

    const sql = postgres(databaseUrl, { max: 1, prepare: false });
    try {
      const [account] = await sql<{ id: string; role: string; status: string }[]>`SELECT id, role, status FROM accounts WHERE canonical_email = ${learnerEmail}`;
      const [attempt] = await sql<{ count: string }[]>`SELECT count(*) FROM practice_attempts WHERE learner_id = ${account!.id} AND practice_set_id = ${fixture.setId} AND practice_set_version_id = ${fixture.setId} AND status = 'open' AND revision = 0`;
      expect(account).toMatchObject({ role: "learner", status: "active" });
      expect(attempt?.count).toBe("1");
    } finally {
      await sql.end();
    }
  } finally {
    await learnerContext.close();
  }
});

test("a published word-bank set without media prepares and starts", async ({ browser }) => {
  const learnerContext = await browser.newContext();
  const learnerPage = await learnerContext.newPage();
  try {
    await learnerContext.addCookies([{ name: "cambridgeyle_session", value: fixture.clozeLearnerSessionToken, url: "http://127.0.0.1:3100", httpOnly: true, secure: false, sameSite: "Lax" }]);
    await learnerPage.goto("/learner");
    const card = learnerPage.getByText("Word bank practice").locator("..");
    await card.getByRole("link", { name: "Start" }).click();
    await expect(learnerPage.getByText("No essential media is required for this practice.")).toBeVisible();
    const start = await learnerPage.request.post("/api/practice/start", { data: { setId: fixture.clozeSetId } });
    expect(start.status()).toBe(201);
    expect((await start.json()).data.setId).toBe(fixture.clozeSetId);
  } finally {
    await learnerContext.close();
  }
});

test("an admin reviewing an active learner without submissions sees neutral empty evidence and a safe NO_DATA audit", async ({ context, page }) => {
  await context.addCookies([{ name: "cambridgeyle_session", value: fixture.adminSessionToken, url: "http://127.0.0.1:3100", httpOnly: true, secure: false, sameSite: "Lax" }]);
  await page.goto(`/admin/accounts/${fixture.emptyLearnerId}`);
  await page.getByRole("link", { name: "Review practice evidence" }).click();
  await expect(page).toHaveURL(new RegExp(`/teacher\\?learner=${fixture.emptyLearnerId}$`));
  await expect(page.getByRole("heading", { name: "Learner evidence detail" })).toBeVisible();
  await expect(page.getByText("State: not assessed yet")).toBeVisible();
  await expect(page.getByText("No completed practice yet for this selection.")).toBeVisible();
  await expect(page.getByText(/level/i)).toHaveCount(0);

  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    const [audit] = await sql<{ action: string; target_id: string; target_scope: string | null; outcome: string | null }[]>`SELECT action, target_id, target_scope, outcome FROM audit_events WHERE action = 'EVIDENCE_READ' AND actor_id = ${fixture.adminId} AND target_id = ${fixture.emptyLearnerId} ORDER BY created_at DESC LIMIT 1`;
    expect(audit).toEqual({ action: "EVIDENCE_READ", target_id: fixture.emptyLearnerId, target_scope: "LEARNER_DETAIL", outcome: "NO_DATA" });
  } finally {
    await sql.end();
  }
});
