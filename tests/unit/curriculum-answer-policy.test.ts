import { describe, expect, it } from "vitest";
import {
  evaluateAnswer,
  normaliseAnswer,
  validateVectors,
} from "@/features/curriculum/domain/answer-policy";
import {
  policyVersionSchema,
  type PolicyVersionInput,
} from "@/features/curriculum/domain/contracts";
import { finalisationResponse, finalTimingSnapshot } from "@/features/practice/infrastructure/repositories";
const base: PolicyVersionInput = {
  canonicalId: "number-one",
  targetId: "018f0000-0000-7000-8000-000000000001",
  guidanceId: "018f0000-0000-7000-8000-000000000002",
  paper: "listening",
  part: 2,
  engine: "audio_note_taking",
  inputKind: "number",
  canonicalAnswer: 1,
  acceptedAnswers: [],
  normalisation: {
    unicode: "NFC",
    locale: "en-GB",
    caseSensitive: false,
    trimWhitespace: true,
    normalizePunctuation: true,
    normalizeNumberForms: true,
  },
  maxWords: 1,
  teacherReviewIfUncertain: false,
  vectors: [
    { response: 1, expectedOutcome: "correct" },
    { response: 2, expectedOutcome: "incorrect" },
  ],
};
describe("answer policy matching", () => {
  it("applies Unicode, British case, whitespace, punctuation and number-form semantics deterministically", () => {
    expect(
      normaliseAnswer("  CAFÉ!  ", {
        ...base,
        inputKind: "word",
        normalisation: { ...base.normalisation, normalizeNumberForms: false },
      }),
    ).toBe("café");
    expect(evaluateAnswer("one", base)).toBe("correct");
    expect(evaluateAnswer(2, base)).toBe("incorrect");
  });
  it("permits and verifies controlled textual number-form conformance vectors", () => {
    const policy = {
      ...base,
      vectors: [
        { response: "one", expectedOutcome: "correct" as const },
        { response: 2, expectedOutcome: "incorrect" as const },
      ],
    };
    expect(policyVersionSchema.safeParse(policy).success).toBe(true);
    expect(validateVectors(policy)).toEqual([]);
  });
  it("normalises numeric text only at finalisation before deterministic evaluation", () => {
    const response = finalisationResponse(" one ", base);
    expect(response).toBe(1);
    expect(evaluateAnswer(response, base)).toBe("correct");
    expect(finalisationResponse("cat", base)).toBe("cat");
  });
  it("uses one submitted instant for final saved and submitted timing", () => {
    const submittedAt = new Date("2026-08-20T12:00:00.000Z");
    expect(finalTimingSnapshot({ createdAt: new Date("2026-08-20T11:00:00.000Z") } as never, submittedAt)).toEqual({ startedAt: "2026-08-20T11:00:00.000Z", lastSavedAt: "2026-08-20T12:00:00.000Z", submittedAt: "2026-08-20T12:00:00.000Z" });
  });
  it("reserves teacher review for configured name and word policies", () => {
    expect(evaluateAnswer("one extra", base)).toBe("incorrect");
    expect(evaluateAnswer("1", base)).toBe("incorrect");
    const wordPolicy = {
      ...base,
      engine: "word_bank_cloze" as const,
      inputKind: "word" as const,
      canonicalAnswer: "cat",
      teacherReviewIfUncertain: true,
      vectors: [
        { response: "cat", expectedOutcome: "correct" as const },
        { response: "dog", expectedOutcome: "incorrect" as const },
        {
          response: "too many words",
          expectedOutcome: "needs_teacher_review" as const,
        },
      ],
    };
    expect(policyVersionSchema.safeParse(wordPolicy).success).toBe(true);
    expect(evaluateAnswer("too many words", wordPolicy)).toBe(
      "needs_teacher_review",
    );
  });
  it("blocks a conformance vector whose expected outcome conflicts with matching", () =>
    expect(
      validateVectors({
        ...base,
        vectors: [
          { response: 1, expectedOutcome: "incorrect" },
          ...base.vectors.slice(1),
        ],
      }),
    ).toEqual([
      {
        field: "vectors.0.expectedOutcome",
        code: "CONFORMANCE_VECTOR_CONFLICT",
        message: "The expected outcome conflicts with deterministic matching.",
      },
    ]));
  it("enforces engine/input-kind and typed answer shapes for every P0 input kind", () => {
    const cases = [
      ["picture_true_false", "boolean", true],
      ["picture_yes_no", "yes_no", "yes"],
      ["audio_picture_choice", "choice", "a"],
      ["audio_note_taking", "number", 1],
      ["audio_note_taking", "name", "sam"],
      ["audio_note_taking", "word", "cat"],
      ["word_bank_cloze", "word", "cat"],
    ] as const;
    for (const [engine, inputKind, answer] of cases) {
      const incorrect =
        inputKind === "boolean"
          ? false
          : inputKind === "number"
            ? 2
            : inputKind === "yes_no"
              ? "no"
              : "wrong";
      expect(
        policyVersionSchema.safeParse({
          ...base,
          engine,
          inputKind,
          canonicalAnswer: answer,
          vectors: [
            { response: answer, expectedOutcome: "correct" },
            { response: incorrect, expectedOutcome: "incorrect" },
          ],
        }).success,
      ).toBe(true);
    }
    expect(
      policyVersionSchema.safeParse({
        ...base,
        engine: "picture_true_false",
        inputKind: "boolean",
        canonicalAnswer: "true",
      }).success,
    ).toBe(false);
    expect(
      policyVersionSchema.safeParse({
        ...base,
        policyId: "018f0000-0000-7000-8000-000000000003",
      }).success,
    ).toBe(false);
  });
  it("canonicalises identifiers and rejects underscores", () => {
    expect(
      policyVersionSchema.safeParse({ ...base, canonicalId: " Word-Cat " }).data
        ?.canonicalId,
    ).toBe("word-cat");
    expect(
      policyVersionSchema.safeParse({ ...base, canonicalId: "word_cat" })
        .success,
    ).toBe(false);
  });
});
