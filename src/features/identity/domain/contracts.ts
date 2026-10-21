import { z } from "zod";

export const roles = ["learner", "teacher", "academic_lead", "admin"] as const;
export type Role = (typeof roles)[number];
export type Actor = { id: string; role: Role; email: string; displayName: string };

export const canonicalEmail = (email: string) => email.trim().toLowerCase();
const emailSchema = z.string().trim().pipe(z.email()).transform(canonicalEmail);
export const localSignInSchema = z.object({ email: emailSchema, password: z.string().min(1).max(1024) });
/* Learners sign in with the password set here; staff sign in with Google, so their password is optional and only used outside production. */
export const createAccountSchema = z.object({
  email: emailSchema,
  displayName: z.string().trim().min(1).max(120),
  password: z.preprocess((value) => value === "" ? undefined : value, z.string().min(12).max(1024).optional()),
  role: z.enum(roles)
}).refine((account) => account.role !== "learner" || account.password !== undefined, { path: ["password"] });
export const deactivateAccountSchema = z.object({
  accountId: z.string().uuid(),
  confirmation: z.string().min(1).max(320).refine((value) => value === value.trim())
});
export const changeAccountRoleSchema = z.object({
  accountId: z.string().uuid(),
  role: z.enum(roles)
});

export const genericSignInError = { code: "SIGN_IN_FAILED", message: "We could not sign you in with those details." };
