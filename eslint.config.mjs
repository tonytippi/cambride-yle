import js from "@eslint/js";
import nextVitals from "eslint-config-next/core-web-vitals";

/* The learner surface and the staff surface stay separable, so the learner client can later move to its own app. */
const learnerBoundary = {
  files: ["src/app/(learner)/**"],
  rules: { "no-restricted-imports": ["error", { patterns: [
    { group: ["@/app/(staff)/*", "**/(staff)/**"], message: "Learner routes must not depend on staff routes." },
    { group: ["@/features/content/ui/*", "@/features/curriculum/ui/*", "@/features/evidence/ui/*"], message: "Learner routes must not use staff workspace UI." },
  ] }] },
};
const staffBoundary = {
  files: ["src/app/(staff)/**"],
  rules: { "no-restricted-imports": ["error", { patterns: [{ group: ["@/app/(learner)/*", "**/(learner)/**"], message: "Staff routes must not depend on learner routes." }] }] },
};

const config = [js.configs.recommended, ...nextVitals, learnerBoundary, staffBoundary, { ignores: [".next/**", "node_modules/**", "playwright-report/**", "test-results/**"] }];

export default config;
