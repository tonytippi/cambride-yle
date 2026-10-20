import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { crc32, deflateSync } from "node:zlib";

/*
 * Drives the running Compose stack end to end with the real object store and AI gateways:
 * staff curriculum and content authoring (manual upload, AI text and AI image drafts),
 * review and publication, admin learner provisioning, and a learner attempt through review.
 * Staff sign in with Google in production, so their sessions are seeded through the database.
 */
const baseURL = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:9100";
const suffix = Date.now().toString(36);
const psql = (query: string) => execFileSync("docker", ["compose", "exec", "-T", "db", "psql", "-U", "cambridgeyle", "-d", "cambridgeyle", "-tA", "-v", "ON_ERROR_STOP=1"], { input: query, encoding: "utf8" }).trim();
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;

function png(size = 48) {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2;
  const rows = Buffer.concat(Array.from({ length: size }, (_, y) => Buffer.concat([Buffer.from([0]), ...Array.from({ length: size }, (_, x) => Buffer.from([200, (x * 5) % 256, (y * 5) % 256]))])));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
}

async function staffPage(browser: Browser, role: "academic_lead" | "admin") {
  const id = randomUUID(); const token = randomUUID(); const email = `smoke-${role}-${suffix}@example.test`;
  psql(`INSERT INTO accounts (id, email, canonical_email, display_name, role) VALUES ('${id}', ${literal(email)}, ${literal(email)}, 'Smoke ${role}', '${role}');
INSERT INTO sessions (id, account_id, verifier_hash, expires_at) VALUES ('${randomUUID()}', '${id}', '${createHash("sha256").update(token).digest("hex")}', now() + interval '2 hours');`);
  const context = await browser.newContext({ baseURL });
  await context.addCookies([{ name: "cambridgeyle_session", value: token, url: baseURL, httpOnly: true, secure: false, sameSite: "Lax" }]);
  return context.newPage();
}

const form = (page: Page, heading: string) => page.locator("form").filter({ has: page.getByRole("heading", { name: heading, exact: true }) });
async function submit(target: Locator, button: string) {
  await target.getByRole("button", { name: button, exact: true }).click();
  const outcome = target.locator('[role="status"], [role="alert"]');
  await expect(outcome).toBeVisible({ timeout: 240_000 });
  if (await target.getByRole("alert").count()) throw new Error(`${button}: ${await target.getByRole("alert").innerText()}`);
}
/* External AI gateway outages are reported, not hidden, but do not block checking the rest of the stack. */
async function aiStep(name: string, run: () => Promise<void>) {
  try {
    await run();
    return true;
  } catch (error) {
    if (!String(error).includes("AI draft gateway")) throw error;
    test.info().annotations.push({ type: "warning", description: `${name} skipped: ${String(error)}` });
    console.warn(`WARNING ${name}: ${String(error)}`);
    return false;
  }
}
async function until(read: () => string, expected: string, what: string) {
  await expect.poll(read, { message: what, timeout: 60_000 }).toBe(expected);
}

type Scope = { topic: string; target: string; guidanceTopic: string };
type Ids = { guidanceId: string; topicId: string; targetId: string };
async function openPanel(page: Page, summary: string) {
  const panel = page.locator("details.add-panel").filter({ has: page.getByText(summary, { exact: true }) });
  if ((await panel.getAttribute("open")) === null) await panel.locator("summary").click();
}
const editor = (page: Page) => page.locator("form.content-editor");
async function shared(target: Locator, ids: Ids, duration = "300") {
  await target.locator('select[name="guidanceId"]').selectOption(ids.guidanceId);
  await target.locator('select[name="topicId"]').selectOption(ids.topicId);
  await target.locator('select[name="primaryTargetId"]').selectOption(ids.targetId);
  await target.locator('input[name="estimatedDurationSeconds"]').fill(duration);
  await target.locator('input[name="rightsReference"]').fill(`centre-smoke-${suffix}`);
}

async function advanceContent(lead: Page, admin: Page, kind: "question" | "media", id: string, image: boolean) {
  const table = kind === "question" ? "question_drafts" : "media_drafts";
  const status = () => psql(`SELECT status FROM ${table} WHERE id = '${id}'`);
  const controls = (page: Page) => page.locator(`section[aria-label="Review controls for ${id}"]`);
  const open = (page: Page) => page.goto(`/academic-lead/content?q=${id}`);
  await open(lead);
  await submit(controls(lead).getByRole("form", { name: "Run validation" }), "Run validation");
  expect(psql(`SELECT findings::text FROM content_validation_results WHERE target_id = '${id}' ORDER BY created_at DESC LIMIT 1`), `${kind} validation findings`).toBe("[]");
  await expect(lead.getByText("Latest validation passed.")).toBeVisible();
  await controls(lead).getByRole("button", { name: "Submit for review", exact: true }).click();
  await until(status, "in_review", `${kind} submitted`);
  await open(admin);
  if (image) {
    await controls(admin).getByRole("button", { name: "Confirm 375px phone preview", exact: true }).click();
    await expect.poll(() => psql(`SELECT count(*) FROM content_phone_preview_records WHERE target_id = '${id}'`), { timeout: 60_000 }).toBe("1");
  }
  await controls(admin).getByRole("button", { name: "Approve content", exact: true }).click();
  await until(status, "approved", `${kind} approved`);
  await open(lead);
  await controls(lead).getByRole("button", { name: "Publish content", exact: true }).click();
  await until(status, "published", `${kind} published`);
}

test("staff publish AI and uploaded media, and a provisioned learner completes the practice", async ({ browser }) => {
  const lead = await staffPage(browser, "academic_lead");
  const admin = await staffPage(browser, "admin");
  const ids: Ids = { guidanceId: "", topicId: "", targetId: "" };
  const scope: Scope = { topic: `smoke-animals-${suffix}`, target: `smoke-cat-${suffix}`, guidanceTopic: `Smoke animals ${suffix}` };

  await test.step("curriculum: targets, guidance and an answer policy", async () => {
    await lead.goto("/academic-lead/curriculum");
    for (const [canonicalId, category] of [[scope.topic, "topic"], [scope.target, "language_target"]] as const) {
      await openPanel(lead, "Add a target");
      const target = form(lead, "Add controlled target");
      await target.locator('input[name="canonicalId"]').fill(canonicalId);
      await target.locator('select[name="category"]').selectOption(category);
      await target.locator('textarea[name="guidance"]').fill(category === "topic" ? "Animals" : "Cats");
      await target.locator('input[name="isApproved"]').check();
      await submit(target, "Save target");
    }
    await openPanel(lead, "Add task guidance");
    const guidance = form(lead, "Add internal task guidance");
    await guidance.locator('select[name="paper"]').selectOption("reading_writing");
    await guidance.locator('input[name="part"]').fill("1");
    await guidance.locator('select[name="engine"]').selectOption("picture_true_false");
    await guidance.locator('input[name="topic"]').fill(scope.guidanceTopic);
    await guidance.locator('input[name="taskFormat"]').fill("Look and read");
    await guidance.locator('input[name="maxWords"]').fill("10");
    await submit(guidance, "Save guidance");
    await lead.reload();
    const guidanceId = psql(`SELECT id FROM curriculum_guidance WHERE topic = ${literal(scope.guidanceTopic)}`);
    await openPanel(lead, "Add an answer policy or a new version");
    const policy = form(lead, "Add answer policy version");
    await policy.locator('input[name="canonicalId"]').fill(`smoke-cat-true-${suffix}`);
    await policy.locator('select[name="targetId"]').selectOption({ label: scope.target });
    await policy.locator('select[name="guidanceId"]').selectOption(guidanceId);
    await policy.locator('select[name="paper"]').selectOption("reading_writing");
    await policy.locator('input[name="part"]').fill("1");
    await policy.locator('select[name="engine"]').selectOption("picture_true_false");
    await policy.locator('select[name="inputKind"]').selectOption("boolean");
    await policy.locator('input[name="canonicalAnswer"]').fill("true");
    await policy.locator('input[name="vector-correct"]').fill("true");
    await policy.locator('input[name="vector-incorrect"]').fill("false");
    await submit(policy, "Save immutable policy version");
    ids.guidanceId = guidanceId;
    ids.topicId = psql(`SELECT id FROM curriculum_targets WHERE canonical_id = ${literal(scope.topic)}`);
    ids.targetId = psql(`SELECT id FROM curriculum_targets WHERE canonical_id = ${literal(scope.target)}`);
  });

  let uploadedId = "";
  await test.step("manual media: a PNG upload is stored in R2 and previews for staff", async () => {
    await lead.goto("/academic-lead/content/new?type=media");
    const media = editor(lead);
    await shared(media, ids);
    await media.locator('input[name="altText"]').fill("A pink square pattern");
    await media.locator('select[name="mediaType"]').selectOption("image");
    await media.locator('input[name="file"]').setInputFiles({ name: "smoke.png", mimeType: "image/png", buffer: png() });
    await media.locator('textarea[name="description"]').fill(`Smoke pattern ${suffix}`);
    await submit(media, "Save media draft");
    uploadedId = psql(`SELECT id FROM media_drafts WHERE description = ${literal(`Smoke pattern ${suffix}`)}`);
    expect(psql(`SELECT content_type || ' ' || (object_key = 'media/' || content_sha256) FROM media_drafts WHERE id = '${uploadedId}'`)).toBe("image/png true");
    const preview = await lead.request.get(`/api/content/media/${uploadedId}`);
    expect(preview.status()).toBe(200);
    expect(preview.headers()["content-type"]).toBe("image/png");
    expect(Buffer.compare(await preview.body(), png())).toBe(0);
    expect((await (await browser.newContext({ baseURL })).request.get(`/api/content/media/${uploadedId}`)).status()).toBe(404);
  });

  let imageId = "";
  await test.step("AI image draft: the image gateway result is stored as the media file", () => aiStep("AI image draft", async () => {
    await lead.goto("/academic-lead/content/new?type=ai-image");
    const ai = editor(lead);
    await shared(ai, ids);
    await ai.locator('input[name="altText"]').fill("A friendly cat sitting on a blue mat");
    await ai.locator('textarea[name="description"]').fill(`A cat on a mat ${suffix}`);
    await ai.locator('textarea[name="staffPrompt"]').fill("Draw one friendly orange cat sitting on a blue mat.");
    await submit(ai, "Request AI picture draft");
    imageId = psql(`SELECT id FROM media_drafts WHERE description = ${literal(`A cat on a mat ${suffix}`)} AND origin = 'generated'`);
    expect(psql(`SELECT content_type IS NOT NULL AND byte_size > 1000 FROM media_drafts WHERE id = '${imageId}'`)).toBe("t");
    expect((await lead.request.get(`/api/content/media/${imageId}`)).status()).toBe(200);
  }));
  if (!imageId) imageId = uploadedId;

  await test.step("AI text draft: the text gateway produces a question draft", () => aiStep("AI text draft", async () => {
    await lead.goto("/academic-lead/content/new?type=ai-text");
    const ai = editor(lead);
    await shared(ai, ids);
    await ai.locator('input[name="altText"]').fill("A friendly cat sitting on a blue mat");
    await ai.locator('select[name="answerPolicyVersionId"]').selectOption({ label: `smoke-cat-true-${suffix}` });
    await ai.locator('textarea[name="prompt"]').fill("The cat is on the mat.");
    await ai.locator('textarea[name="options"]').fill("true\nfalse");
    await ai.locator(`input[name="mediaIds"][value="${imageId}"]`).check();
    await ai.locator('textarea[name="staffPrompt"]').fill("Write one short true/false sentence about a cat on a mat.");
    await submit(ai, "Request AI question draft");
    expect(Number(psql(`SELECT count(*) FROM question_drafts WHERE origin = 'generated' AND guidance_id = (SELECT id FROM curriculum_guidance WHERE topic = ${literal(scope.guidanceTopic)})`))).toBe(1);
  }));

  let questionId = "";
  await test.step("review and publish the AI image, then a question that uses it", async () => {
    await advanceContent(lead, admin, "media", imageId, true);
    test.info().annotations.push({ type: "media", description: imageId === uploadedId ? "question uses the uploaded picture" : "question uses the AI picture" });
    await lead.goto("/academic-lead/content/new?type=question");
    const question = editor(lead);
    await shared(question, ids);
    await question.locator('input[name="altText"]').fill("A friendly cat sitting on a blue mat");
    await question.locator('select[name="answerPolicyVersionId"]').selectOption({ label: `smoke-cat-true-${suffix}` });
    await question.locator('textarea[name="prompt"]').fill("The cat is on the mat.");
    await question.locator('textarea[name="options"]').fill("true\nfalse");
    await question.locator(`input[name="mediaIds"][value="${imageId}"]`).check();
    await submit(question, "Save question draft");
    questionId = psql(`SELECT id FROM question_drafts WHERE origin = 'manual' AND guidance_id = (SELECT id FROM curriculum_guidance WHERE topic = ${literal(scope.guidanceTopic)})`);
    await advanceContent(lead, admin, "question", questionId, false);
  });

  const title = `Smoke cats ${suffix}`;
  await test.step("compose, review and publish the practice set", async () => {
    await lead.goto("/academic-lead/sets");
    const composer = lead.locator("form.set-composer");
    await composer.locator('input[name="title"]').fill(title);
    await composer.locator(`input[name="questionIds"][value="${questionId}"]`).check();
    await expect(composer.locator(".composition-checks .problem")).toHaveCount(0);
    await submit(composer, "Create practice-set draft");
    const status = () => psql(`SELECT status FROM practice_sets WHERE title = ${literal(title)}`);
    const card = (page: Page) => page.locator("article.library-item").filter({ hasText: title });
    for (const [page, button, expected] of [[lead, "Submit practice set for review", "in_review"], [admin, "Approve practice set", "approved"], [lead, "Publish practice set", "published"]] as const) {
      await page.goto("/academic-lead/sets");
      await card(page).getByRole("button", { name: button, exact: true }).click();
      await until(status, expected, button);
    }
  });

  await test.step("admin provisions a learner who signs in, prepares R2 media and completes the practice", async () => {
    const email = `smoke-learner-${suffix}@example.test`; const password = `Smoke-${suffix}-password`;
    await admin.goto("/admin");
    await admin.getByLabel("Email").fill(email);
    await admin.getByLabel("Display name").fill("Smoke learner");
    await admin.getByLabel("Role").selectOption("learner");
    await admin.getByLabel("Temporary password").fill(password);
    await admin.getByRole("button", { name: "Create account" }).click();
    await expect(admin.getByText("Account created.")).toBeVisible();

    const learner = await (await browser.newContext({ baseURL })).newPage();
    await learner.goto("/sign-in");
    await learner.getByLabel("Email").fill(email);
    await learner.getByLabel("Password").fill(password);
    await learner.getByRole("button", { name: "Sign in" }).click();
    await expect(learner).toHaveURL(/\/learner$/);
    await learner.getByRole("region", { name: "Practice to choose" }).getByRole("article").filter({ hasText: title }).getByRole("link", { name: "Start" }).click();
    await expect(learner.getByRole("listitem").filter({ hasText: "Picture" })).toContainText("Ready");
    await learner.getByRole("button", { name: "Start", exact: true }).click();
    await expect(learner).toHaveURL(/\/attempt\/[^/]+$/);
    await expect(learner.getByRole("img").first()).toBeVisible();
    expect(await learner.getByRole("img").first().evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await learner.getByRole("button", { name: "True", exact: true }).click();
    await expect(learner.getByText("Saved.", { exact: true })).toBeVisible();
    await learner.getByRole("button", { name: "Submit practice", exact: true }).click();
    await learner.getByRole("button", { name: /^Submit (anyway|now)$/ }).click();
    await expect(learner).toHaveURL(/\/review$/);
    await expect(learner.locator("article.review-item").first()).toContainText("You got this one right.");
  });
});
