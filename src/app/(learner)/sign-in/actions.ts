"use server";
import { signInWithPassword } from "@/features/identity/ui/password-sign-in";

export async function signInAction(_: { error?: string }, formData: FormData) { return signInWithPassword("learner", formData); }
