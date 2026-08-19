import { z } from "zod";

export const roles = ["learner", "teacher", "academic_lead", "admin"] as const;
export type Role = (typeof roles)[number];
export type Actor = { id: string; role: Role; email: string; displayName: string };

const emailSchema = z.string().trim().pipe(z.email()).transform((value) => value.toLowerCase());
export const localSignInSchema = z.object({ email: emailSchema, password: z.string().min(1).max(1024) });
export const createAccountSchema = z.object({
  email: emailSchema,
  displayName: z.string().trim().min(1).max(120),
  password: z.string().min(12).max(1024),
  role: z.enum(roles)
});

export const genericSignInError = { code: "SIGN_IN_FAILED", message: "We could not sign you in with those details." };
