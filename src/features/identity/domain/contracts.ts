import { z } from "zod";

export const roles = ["learner", "teacher", "academic_lead", "admin"] as const;
export type Role = (typeof roles)[number];
export type Actor = { id: string; role: Role; email: string; displayName: string };

export const canonicalEmail = (email: string) => email.trim().toLowerCase();
const emailSchema = z.string().trim().pipe(z.email()).transform(canonicalEmail);
export const localSignInSchema = z.object({ email: emailSchema, password: z.string().min(1).max(1024) });
export const createAccountSchema = z.object({
  email: emailSchema,
  displayName: z.string().trim().min(1).max(120),
  password: z.string().min(12).max(1024),
  role: z.enum(roles)
});
export const deactivateAccountSchema = z.object({
  accountId: z.string().uuid(),
  confirmation: z.string().min(1).max(320).refine((value) => value === value.trim())
});
export const changeAccountRoleSchema = z.object({
  accountId: z.string().uuid(),
  role: z.enum(roles)
});

export const genericSignInError = { code: "SIGN_IN_FAILED", message: "We could not sign you in with those details." };
