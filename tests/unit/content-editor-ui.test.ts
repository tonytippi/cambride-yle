import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ContentEditor, type EditorSource } from "@/features/content/ui/content-editor";
import { compositionChecks, type ComposerQuestion } from "@/features/content/ui/set-composer";

const action = async () => ({});
const targets = [
  { id: "topic-1", canonicalId: "animals", category: "topic", guidance: "Animals", isApproved: true },
  { id: "target-1", canonicalId: "cat", category: "vocabulary", guidance: "Cat", isApproved: true },
  { id: "target-2", canonicalId: "dog", category: "vocabulary", guidance: "Dog", isApproved: false },
];
const guidance = [
  { id: "guide-1", paper: "reading_writing", part: 1, engine: "picture_true_false", topic: "Animals", taskFormat: "Look and read", maxWords: 10, maxOptions: 2 },
  { id: "guide-2", paper: "listening", part: 2, engine: "audio_note_taking", topic: "Names", taskFormat: "Listen and write", maxWords: 10, maxOptions: 2 },
];
const policies = [{ canonicalId: "cat-true", currentVersionId: "version-1", guidanceId: "guide-1" }, { canonicalId: "name-tom", currentVersionId: "version-2", guidanceId: "guide-2" }];
const media = [
  { id: "media-1", mediaType: "image", status: "published", paper: "reading_writing", part: "1", engine: "picture_true_false", description: "A cat picture", hasFile: true },
  { id: "media-2", mediaType: "audio", status: "published", paper: "listening", part: "2", engine: "audio_note_taking", description: "A name recording", hasFile: true },
  { id: "media-3", mediaType: "image", status: "retired", paper: "reading_writing", part: "1", engine: "picture_true_false", description: "An old cat picture", hasFile: true },
];
const source: EditorSource = { id: "question-1", guidanceId: "guide-1", primaryTargetId: "target-1", topicId: "topic-1", supportingTargetIds: [], estimatedDurationSeconds: 300, altText: "A cat on a mat", source: "Centre", rightsReference: "Owned", spelling: [], colours: [], positions: [], answerPolicyVersionId: "version-1", prompt: "The cat is on the mat.", options: ["true", "false"], mediaIds: ["media-1"] };
const render = (props: Partial<Parameters<typeof ContentEditor>[0]>) => renderToStaticMarkup(createElement(ContentEditor, { mode: "question", action, targets, guidance, policies, media, ...props }));

describe("content editor", () => {
  it("derives paper, part and engine from the chosen guidance and scopes policies and media to it", () => {
    const markup = render({ source });
    expect(markup).toContain('name="paper" value="reading_writing"');
    expect(markup).toContain('name="engine" value="picture_true_false"');
    expect(markup).toContain("cat-true");
    expect(markup).not.toContain("name-tom");
    expect(markup).toContain("A cat picture");
    expect(markup).not.toContain("A name recording");
    expect(markup).not.toContain("An old cat picture");
    expect(markup).toContain('name="sourceId" value="question-1"');
    expect(markup).toContain("as a new revision");
  });

  it("offers only approved targets and separates topics from objectives", () => {
    const markup = render({});
    expect(markup).toMatch(/name="topicId"[^]*animals —[^]*<\/select>/);
    expect(markup).not.toContain("dog —");
    expect(markup).toContain("Choose task guidance to see matching media.");
  });

  it("asks for a file on new media and keeps the existing file on a revision", () => {
    expect(render({ mode: "media" })).toMatch(/<input type="file"[^>]*required=""[^>]*name="file"/);
    expect(render({ mode: "media", source: { ...source, mediaType: "image", description: "A cat", hasFile: true } })).toContain("Leave empty to keep the current file.");
  });
});

describe("practice-set composition checks", () => {
  const question = (id: string, durationSeconds: number, primaryTargetId = "target-1", part = "1"): ComposerQuestion => ({ id, prompt: id, engine: "picture_true_false", paper: "reading_writing", part, durationSeconds, primaryTargetId, objective: "cat", topic: "Animals", mediaCount: 1 });
  it("mirrors the server rules for time, scope and objectives", () => {
    expect(compositionChecks([]).checks.every((check) => check.ok)).toBe(false);
    expect(compositionChecks([question("a", 180), question("b", 180)]).checks.every((check) => check.ok)).toBe(true);
    expect(compositionChecks([question("a", 120)]).checks.find((check) => check.label.startsWith("Total time"))?.ok).toBe(false);
    expect(compositionChecks([question("a", 200), question("b", 200, "target-1", "2")]).checks.find((check) => check.label.includes("paper"))?.ok).toBe(false);
    expect(compositionChecks([question("a", 100, "t1"), question("b", 100, "t2"), question("c", 100, "t3")]).checks.find((check) => check.label.includes("objective"))?.ok).toBe(false);
  });
});
