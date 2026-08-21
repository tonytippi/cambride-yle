"use server";
import { revalidatePath } from "next/cache";
import { changeAccountRoleSchema, createAccountSchema, deactivateAccountSchema } from "@/features/identity/domain/contracts";
import { changeCentreAccountRole, createCentreAccount, deactivateCentreAccount, IdentityError } from "@/features/identity/application/auth";
import { currentActor } from "@/features/identity/ui/session";

export async function createAccountAction(_: { error?: string; success?: string }, formData: FormData) {
  const actor = await currentActor(); if (!actor) return { error: "You do not have access to that page." };
  const parsed = createAccountSchema.safeParse(Object.fromEntries(formData)); if (!parsed.success) return { error: "Enter an email, name and password of at least 12 characters." };
  try { await createCentreAccount(actor, parsed.data); revalidatePath("/admin"); return { success: "Account created." }; } catch (error) { return { error: error instanceof IdentityError ? error.message : "The account could not be created." }; }
}
export async function deactivateAccountAction(_: { error?: string; success?: string }, formData: FormData) {
  const actor = await currentActor(); if (!actor) return { error: "You do not have access to that page." };
  const parsed = deactivateAccountSchema.safeParse(Object.fromEntries(formData)); if (!parsed.success) return { error: "Enter the account email exactly to confirm deactivation." };
  try { await deactivateCentreAccount(actor, parsed.data); revalidatePath("/admin"); revalidatePath(`/admin/accounts/${parsed.data.accountId}`); return { success: "Account deactivated. Sign-in has stopped and records are retained." }; } catch (error) { return { error: error instanceof IdentityError ? error.message : "The account could not be deactivated." }; }
}
export async function changeAccountRoleAction(_: { error?: string; success?: string }, formData: FormData) {
  const actor = await currentActor(); if (!actor) return { error: "You do not have access to that page." };
  const parsed = changeAccountRoleSchema.safeParse(Object.fromEntries(formData)); if (!parsed.success) return { error: "Choose a valid account role." };
  try { await changeCentreAccountRole(actor, parsed.data); revalidatePath("/admin"); revalidatePath(`/admin/accounts/${parsed.data.accountId}`); return { success: "Account role updated." }; } catch (error) { return error instanceof IdentityError ? { code: error.code, error: error.message } : { error: "The account role could not be updated." }; }
}
