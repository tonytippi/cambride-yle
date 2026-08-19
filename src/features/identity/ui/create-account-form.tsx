"use client";
import { useActionState } from "react";
type State = { error?: string; success?: string };
// eslint-disable-next-line no-unused-vars
type CreateAccountAction = (state: State, data: FormData) => Promise<State>;
export function CreateAccountForm({ action }: { action: CreateAccountAction }) { const [state, formAction, pending] = useActionState(action, {}); return <form action={formAction} className="sign-in-form"><label>Email<input name="email" type="email" required /></label><label>Display name<input name="displayName" required /></label><label>Role<select name="role" defaultValue="learner"><option value="learner">Learner</option><option value="teacher">Teacher</option><option value="academic_lead">Academic lead</option><option value="admin">Admin</option></select></label><label>Temporary password<input name="password" type="password" minLength={12} required /></label>{state.error && <p role="alert" className="error">{state.error}</p>}{state.success && <p role="status" className="notice">{state.success}</p>}<button disabled={pending}>{pending ? "Creating account..." : "Create account"}</button></form>; }
