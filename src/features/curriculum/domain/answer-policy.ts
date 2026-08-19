import type { Outcome, PolicyVersionInput } from "./contracts";
type Semantics = Pick<
  PolicyVersionInput,
  | "inputKind"
  | "canonicalAnswer"
  | "acceptedAnswers"
  | "normalisation"
  | "maxWords"
  | "teacherReviewIfUncertain"
>;
const numberWords: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};
export function normaliseAnswer(value: unknown, semantics: Semantics): unknown {
  if (typeof value !== "string") return value;
  let answer = value.normalize(semantics.normalisation.unicode);
  if (semantics.normalisation.trimWhitespace)
    answer = answer.trim().replace(/\s+/g, " ");
  if (semantics.normalisation.normalizePunctuation)
    answer = answer.replace(/[’‘]/g, "'").replace(/[.,!?;:]/g, "");
  if (!semantics.normalisation.caseSensitive)
    answer = answer.toLocaleLowerCase(semantics.normalisation.locale);
  return semantics.normalisation.normalizeNumberForms &&
    semantics.inputKind === "number"
    ? (numberWords[answer] ?? answer)
    : answer;
}
export function evaluateAnswer(
  response: unknown,
  semantics: Semantics,
): Outcome {
  const uncertain = () =>
    semantics.teacherReviewIfUncertain &&
    (semantics.inputKind === "name" || semantics.inputKind === "word")
      ? "needs_teacher_review"
      : ("incorrect" as Outcome);
  const expectedType =
    semantics.inputKind === "boolean"
      ? "boolean"
      : semantics.inputKind === "number"
        ? "number"
        : "string";
  if (
    typeof response === "string" &&
    response.trim().split(/\s+/).filter(Boolean).length > semantics.maxWords
  )
    return uncertain();
  const normalised = normaliseAnswer(response, semantics);
  if (
    typeof normalised !== expectedType ||
    normalised === null ||
    Array.isArray(normalised)
  )
    return uncertain();
  const actual = JSON.stringify(normalised);
  const expected = [
    semantics.canonicalAnswer,
    ...semantics.acceptedAnswers,
  ].map((answer) => JSON.stringify(normaliseAnswer(answer, semantics)));
  return expected.includes(actual) ? "correct" : "incorrect";
}
export function validateVectors(input: PolicyVersionInput) {
  return input.vectors.flatMap((vector, index) =>
    evaluateAnswer(vector.response, input) === vector.expectedOutcome
      ? []
      : [
          {
            field: `vectors.${index}.expectedOutcome`,
            code: "CONFORMANCE_VECTOR_CONFLICT",
            message:
              "The expected outcome conflicts with deterministic matching.",
          },
        ],
  );
}
