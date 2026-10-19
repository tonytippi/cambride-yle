import { expect, test, type Browser, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { approveSeededSet, e2eDatabaseUrl, publishSeededSet, resetE2eSchema } from "./e2e-database";

const id = () => crypto.randomUUID();
const fixture = { staffId: id(), approverId: id(), targetId: id(), guidanceId: id(), policyId: id(), policyVersionId: id(), questionId: id(), mediaId: id(), setId: id(), items: { picture: id(), cloze: id(), notes: id() }, wordsSetId: id(), wordItems: { picture: id(), cloze: id() } };
const learners = { reconnect: id(), reload: id(), unblurred: id(), repeat: id() };
const tokens = Object.fromEntries(Object.keys(learners).map((key) => [key, id()])) as Record<keyof typeof learners, string>;
const policy = (canonicalAnswer: string | boolean, inputKind: string) => ({ canonicalAnswer, acceptedAnswers: [], inputKind, normalisation: { unicode: "NFC", locale: "en-GB", caseSensitive: false, trimWhitespace: true, normalizePunctuation: true, normalizeNumberForms: false }, maxWords: 1, teacherReviewIfUncertain: false, policyId: fixture.policyId, version: 1 });

test.beforeAll(async () => {
  const sql = postgres(e2eDatabaseUrl, { max: 1, prepare: false });
  try {
    await resetE2eSchema(sql);
    await sql.begin(async (tx) => {
      await tx`INSERT INTO accounts (id, email, canonical_email, display_name, role) VALUES (${fixture.staffId}, ${`staff-${fixture.staffId}@example.test`}, ${`staff-${fixture.staffId}@example.test`}, 'Practice Lead', 'academic_lead'), (${fixture.approverId}, ${`approver-${fixture.approverId}@example.test`}, ${`approver-${fixture.approverId}@example.test`}, 'Practice Admin', 'admin')`;
      for (const [key, learnerId] of Object.entries(learners) as [keyof typeof learners, string][]) {
        await tx`INSERT INTO accounts (id, email, canonical_email, display_name, role) VALUES (${learnerId}, ${`${key}-${learnerId}@example.test`}, ${`${key}-${learnerId}@example.test`}, 'Linh', 'learner')`;
        await tx`INSERT INTO sessions (id, account_id, verifier_hash, expires_at) VALUES (${id()}, ${learnerId}, ${createHash("sha256").update(tokens[key]).digest("hex")}, ${new Date(Date.now() + 3_600_000)})`;
      }
      await tx`INSERT INTO curriculum_targets (id, canonical_id, category, guidance, created_by) VALUES (${fixture.targetId}, 'pets', 'vocabulary', 'Pet vocabulary', ${fixture.staffId})`;
      await tx`INSERT INTO curriculum_guidance (id, paper, part, engine, topic, task_format, max_words, max_options, approved_names, approved_numbers) VALUES (${fixture.guidanceId}, 'reading_writing', 1, 'picture_true_false', 'Pets', 'Look and read', 10, 3, '[]'::jsonb, '[]'::jsonb)`;
      await tx`INSERT INTO answer_policies (id, canonical_id, target_id, guidance_id, paper, part, engine) VALUES (${fixture.policyId}, 'pets-policy', ${fixture.targetId}, ${fixture.guidanceId}, 'reading_writing', 1, 'picture_true_false')`;
      await tx`INSERT INTO answer_policy_versions (id, policy_id, version, input_kind, canonical_answer, accepted_answers, normalisation, max_words, teacher_review_if_uncertain, created_by) VALUES (${fixture.policyVersionId}, ${fixture.policyId}, 1, 'boolean', 'true'::jsonb, '[]'::jsonb, '{}'::jsonb, 1, false, ${fixture.staffId})`;
      await tx`INSERT INTO question_drafts (id, status, origin, paper, part, engine, primary_target_id, supporting_target_ids, topic_ids, guidance_id, estimated_duration_seconds, accessibility_metadata, provenance, created_by, answer_policy_version_id, prompt, options) VALUES (${fixture.questionId}, 'published', 'manual', 'reading_writing', '1', 'picture_true_false', ${fixture.targetId}, '[]'::jsonb, '[]'::jsonb, ${fixture.guidanceId}, 120, '{"altText":"A cat on a mat"}'::jsonb, '{"source":"Original","rightsReference":"Owned"}'::jsonb, ${fixture.staffId}, ${fixture.policyVersionId}, 'The cat is on the mat.', '["True","False"]'::jsonb)`;
      await tx`INSERT INTO media_drafts (id, status, origin, paper, part, engine, primary_target_id, supporting_target_ids, topic_ids, guidance_id, estimated_duration_seconds, accessibility_metadata, provenance, created_by, media_type, description) VALUES (${fixture.mediaId}, 'published', 'manual', 'reading_writing', '1', 'picture_true_false', ${fixture.targetId}, '[]'::jsonb, '[]'::jsonb, ${fixture.guidanceId}, 120, '{"altText":"A cat on a mat"}'::jsonb, '{"source":"Original","rightsReference":"Owned"}'::jsonb, ${fixture.staffId}, 'image', 'A cat on a mat')`;
      await tx`INSERT INTO practice_sets (id, title, paper, part, estimated_duration_seconds, primary_target_ids, created_by) VALUES (${fixture.setId}, 'My pets', 'reading_writing', '1', 360, ${JSON.stringify([fixture.targetId])}::jsonb, ${fixture.staffId})`;
      await approveSeededSet(tx, fixture.setId, fixture.staffId, fixture.approverId);
      await publishSeededSet(tx, fixture.setId, async () => {
        const tags = tx.json({ primaryTargetId: fixture.targetId, guidanceId: fixture.guidanceId });
        const provenance = tx.json({ source: "Original", rightsReference: "Owned" });
        await tx`INSERT INTO practice_set_items (id, practice_set_id, position, question_version_id, engine, rendered_prompt, rendered_options, answer_policy, feedback, tags, accessibility_metadata, provenance) VALUES
          (${fixture.items.picture}, ${fixture.setId}, 1, ${fixture.questionId}, 'picture_true_false', 'The cat is on the mat.', '["True","False"]'::jsonb, ${tx.json(policy(true, "boolean"))}, '{}'::jsonb, ${tags}, '{"altText":"A cat on a mat"}'::jsonb, ${provenance}),
          (${fixture.items.cloze}, ${fixture.setId}, 2, ${fixture.questionId}, 'word_bank_cloze', 'I have a pet ____. It says miaow.', '["cat","dog","fish"]'::jsonb, ${tx.json(policy("cat", "word"))}, '{}'::jsonb, ${tags}, '{"altText":"Word bank"}'::jsonb, ${provenance}),
          (${fixture.items.notes}, ${fixture.setId}, 3, ${fixture.questionId}, 'audio_note_taking', 'Write the name of the cat.', '["Write the name"]'::jsonb, ${tx.json(policy("tom", "word"))}, '{}'::jsonb, ${tags}, '{"altText":"Listening"}'::jsonb, ${provenance})`;
        // The E2E media server serves one owned asset; the audio entry reuses its object so server-side preparation succeeds.
        await tx`INSERT INTO practice_set_item_media (id, practice_set_item_id, media_version_id, media_type, object_version, content_hash, accessibility_metadata, provenance) VALUES
          (${id()}, ${fixture.items.picture}, ${fixture.mediaId}, 'image', 'owned-e2e-image.png', 'owned-e2e-image', '{"altText":"A cat on a mat"}'::jsonb, ${provenance}),
          (${id()}, ${fixture.items.notes}, ${fixture.mediaId}, 'audio', 'owned-e2e-image.png', 'owned-e2e-audio', '{"altText":"A child says the cat is called Tom"}'::jsonb, ${provenance})`;
      });
      // A set without audio, so the browser preparation step can complete for repeat-practice journeys.
      await tx`INSERT INTO practice_sets (id, title, paper, part, estimated_duration_seconds, primary_target_ids, created_by) VALUES (${fixture.wordsSetId}, 'Pet words', 'reading_writing', '1', 300, ${JSON.stringify([fixture.targetId])}::jsonb, ${fixture.staffId})`;
      await approveSeededSet(tx, fixture.wordsSetId, fixture.staffId, fixture.approverId);
      await publishSeededSet(tx, fixture.wordsSetId, async () => {
        const tags = tx.json({ primaryTargetId: fixture.targetId, guidanceId: fixture.guidanceId });
        const provenance = tx.json({ source: "Original", rightsReference: "Owned" });
        await tx`INSERT INTO practice_set_items (id, practice_set_id, position, question_version_id, engine, rendered_prompt, rendered_options, answer_policy, feedback, tags, accessibility_metadata, provenance) VALUES
          (${fixture.wordItems.picture}, ${fixture.wordsSetId}, 1, ${fixture.questionId}, 'picture_true_false', 'The cat is on the mat.', '["True","False"]'::jsonb, ${tx.json(policy(true, "boolean"))}, '{}'::jsonb, ${tags}, '{"altText":"A cat on a mat"}'::jsonb, ${provenance}),
          (${fixture.wordItems.cloze}, ${fixture.wordsSetId}, 2, ${fixture.questionId}, 'word_bank_cloze', 'I have a pet ____. It says miaow.', '["cat","dog","fish"]'::jsonb, ${tx.json(policy("cat", "word"))}, '{}'::jsonb, ${tags}, '{"altText":"Word bank"}'::jsonb, ${provenance})`;
        await tx`INSERT INTO practice_set_item_media (id, practice_set_item_id, media_version_id, media_type, object_version, content_hash, accessibility_metadata, provenance) VALUES (${id()}, ${fixture.wordItems.picture}, ${fixture.mediaId}, 'image', 'owned-e2e-image.png', 'owned-e2e-image', '{"altText":"A cat on a mat"}'::jsonb, ${provenance})`;
      });
    });
  } finally {
    await sql.end();
  }
});

async function openAttempt(browser: Browser, learner: keyof typeof learners) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  await context.addCookies([{ name: "cambridgeyle_session", value: tokens[learner], url: "http://127.0.0.1:3100", httpOnly: true, secure: false, sameSite: "Lax" }]);
  const page = await context.newPage();
  await page.goto("/learner");
  // Start through the server contract; browser audio preloading cannot decode the shared image asset.
  const started = await page.request.post("/api/practice/start", { data: { setId: fixture.setId } });
  expect(started.status()).toBe(201);
  const { data } = await started.json() as { data: { attemptId: string } };
  await page.goto(`/learner/practice/${fixture.setId}/attempt/${data.attemptId}`);
  await expect(page.getByText("Question 1 of 3")).toBeVisible();
  return { context, page };
}

const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

async function submitAndReview(page: Page) {
  await button(page, "Submit practice").click();
  await expect(page.getByRole("heading", { name: "Ready to submit?" })).toBeVisible();
  await button(page, "Submit anyway").click();
  await expect(page).toHaveURL(/\/review$/);
  return page.locator("article.review-item");
}

test("answers given offline are saved after reconnecting and appear in the submitted review", async ({ browser }) => {
  const { context, page } = await openAttempt(browser, "reconnect");
  try {
    await context.setOffline(true);
    await button(page, "False").click();
    await expect(page.getByText(/1 answer is waiting to be saved/)).toBeVisible();
    await button(page, "Next").click();
    await button(page, "dog").click();
    await expect(page.getByText(/2 answers are waiting to be saved/)).toBeVisible();

    await context.setOffline(false);
    await expect(page.getByText(/waiting to be saved/)).toHaveCount(0);
    await expect(page.getByText("Saved.", { exact: true })).toBeVisible();

    const reviewed = await submitAndReview(page);
    await expect(reviewed.nth(0)).toContainText("Your answer: False");
    await expect(reviewed.nth(1)).toContainText("Your answer: dog");
    await expect(reviewed.nth(2)).toContainText("Your answer: No answer");

    // Three assessable outcomes for one target now produce a readable, actionable recommendation.
    await page.getByRole("link", { name: "Back to your practice" }).click();
    const recommended = page.getByRole("region", { name: "Recommended for you" });
    await expect(recommended).toContainText("Practise this next: Pet vocabulary · Reading and Writing Part 1");
    await expect(recommended.getByRole("link", { name: "Review" })).toHaveAttribute("href", /\/review$/);
  } finally {
    await context.close();
  }
});

test("answers recovered from the device draft after a reload are saved before submission", async ({ browser }) => {
  const { context, page } = await openAttempt(browser, "reload");
  try {
    await button(page, "True").click();
    await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
    await button(page, "Next").click();
    await context.setOffline(true);
    await button(page, "cat").click();
    await expect(page.getByText(/1 answer is waiting to be saved/)).toBeVisible();
    // Leave while offline once the device draft holds the answer, then return online.
    await expect.poll(() => page.evaluate(() => new Promise<string>((resolve) => {
      const opened = indexedDB.open("cambridgeyle-open-attempt-drafts");
      opened.onsuccess = () => { const all = opened.result.transaction("drafts").objectStore("drafts").getAll(); all.onsuccess = () => { resolve(JSON.stringify(all.result)); opened.result.close(); }; };
    }))).toContain('"cat"');
    const attemptUrl = page.url();
    await page.close();
    await context.setOffline(false);
    const returned = await context.newPage();
    await returned.goto(attemptUrl);
    await expect(returned.getByText("Your recovered answers are ready to continue.").or(returned.getByText("Saved.", { exact: true }))).toBeVisible();
    await expect(returned.getByText(/waiting to be saved/)).toHaveCount(0);

    const reviewed = await submitAndReview(returned);
    await expect(reviewed.nth(0)).toContainText("Your answer: True");
    await expect(reviewed.nth(1)).toContainText("Your answer: cat");
  } finally {
    await context.close();
  }
});

test("a typed note is included when the learner submits without leaving the field", async ({ browser }) => {
  const { context, page } = await openAttempt(browser, "unblurred");
  try {
    await button(page, "Next").click();
    await button(page, "Next").click();
    await page.getByLabel("Type the word, name or number you hear").fill("Tom");
    const reviewed = await submitAndReview(page);
    await expect(reviewed.nth(2)).toContainText("Your answer: Tom");
    await expect(reviewed.nth(2)).toContainText("correct");
  } finally {
    await context.close();
  }
});

test("a learner practises a completed set again and can start an open attempt again while keeping submitted work", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  await context.addCookies([{ name: "cambridgeyle_session", value: tokens.repeat, url: "http://127.0.0.1:3100", httpOnly: true, secure: false, sameSite: "Lax" }]);
  const page = await context.newPage();
  const card = () => page.getByRole("region", { name: "Published practice activities" }).getByRole("article").filter({ hasText: "Pet words" });
  const startFromPreparation = async (label: string) => {
    await expect(button(page, label)).toBeEnabled();
    await button(page, label).click();
    await expect(page).toHaveURL(/\/attempt\/[^/]+$/);
    return page.url();
  };
  try {
    await page.goto("/learner");
    await card().getByRole("link", { name: "Start" }).click();
    const first = await startFromPreparation("Start");
    await button(page, "True").click();
    await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
    const reviewed = await submitAndReview(page);
    await expect(reviewed.nth(0)).toContainText("Your answer: True");
    const reviewUrl = page.url();

    await page.getByRole("link", { name: "Back to your practice" }).click();
    await expect(card().getByRole("link", { name: "Review" })).toBeVisible();
    await card().getByRole("link", { name: "Practise again" }).click();
    const second = await startFromPreparation("Start");
    expect(second).not.toBe(first);
    await expect(button(page, "True")).not.toHaveClass(/selected/);
    await button(page, "False").click();
    await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Save and leave" }).click();

    await expect(card().getByRole("link", { name: "Resume" })).toBeVisible();
    await card().getByRole("link", { name: "Start again" }).click();
    await expect(page.getByText("Starting again clears the answers you saved in this practice. Practice you already submitted stays the same.")).toBeVisible();
    const third = await startFromPreparation("Start again");
    expect(third).not.toBe(second);
    await expect(button(page, "False")).not.toHaveClass(/selected/);

    await page.goto(reviewUrl);
    await expect(page.locator("article.review-item").nth(0)).toContainText("Your answer: True");
  } finally {
    await context.close();
  }
});
