"use client";
import { useActionState } from "react";

type State = { error?: string };
// eslint-disable-next-line no-unused-vars
type SignInAction = (state: State, formData: FormData) => Promise<State>;
export function SignInForm({ action }: { action: SignInAction }) {
  const [state, formAction, pending] = useActionState(action, {});
  return <form action={formAction} className="sign-in-form" noValidate>
    <label>Email<input name="email" type="email" autoComplete="email" required /></label>
    <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
    {state.error && <p role="alert" className="error">{state.error}</p>}
    <button type="submit" disabled={pending}>{pending ? "Signing in..." : "Sign in"}</button>
  </form>;
}
