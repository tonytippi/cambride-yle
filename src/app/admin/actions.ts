"use server";
import { revalidatePath } from "next/cache";
import { createAccountSchema } from "@/features/identity/domain/contracts";
import { createCentreAccount, IdentityError } from "@/features/identity/application/auth";
import { currentActor } from "@/features/identity/ui/session";

export async function createAccountAction(_: { error?: string; success?: string }, formData: FormData) {
  const actor = await currentActor(); if (!actor) return { error: "You do not have access to that page." };
  const parsed = createAccountSchema.safeParse(Object.fromEntries(formData)); if (!parsed.success) return { error: "Enter an email, name and password of at least 12 characters." };
  try { await createCentreAccount(actor, parsed.data); revalidatePath("/admin"); return { success: "Account created." }; } catch (error) { return { error: error instanceof IdentityError ? error.message : "The account could not be created." }; }
}
