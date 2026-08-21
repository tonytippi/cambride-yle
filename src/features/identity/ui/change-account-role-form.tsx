"use client";
import { useActionState } from "react";
import { roles, type Role } from "../domain/contracts";

type State = { code?: string; error?: string; success?: string };
// eslint-disable-next-line no-unused-vars
type ChangeAccountRoleAction = (_state: State, _data: FormData) => Promise<State>;

export function ChangeAccountRoleForm({ accountId, displayName, role, action }: { accountId: string; displayName: string; role: Role; action: ChangeAccountRoleAction }) {
  const [state, formAction, pending] = useActionState(action, {});
  return <form action={formAction} className="sign-in-form" aria-label={`Change role for ${displayName}`}><input type="hidden" name="accountId" value={accountId} /><label htmlFor={`role-${accountId}`}>Account role<select id={`role-${accountId}`} name="role" defaultValue={role} disabled={pending}>{roles.map((option) => <option key={option} value={option}>{option.replace("_", " ")}</option>)}</select></label>{!pending && state.error && <p role="alert" className="error">{state.error}</p>}{!pending && state.success && <p role="status" className="notice">{state.success}</p>}<button disabled={pending}>{pending ? "Updating account role..." : "Update account role"}</button></form>;
}
