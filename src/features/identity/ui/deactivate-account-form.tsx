"use client";
import { useActionState, useEffect, useRef, useState } from "react";

type State = { error?: string; success?: string };
// eslint-disable-next-line no-unused-vars
type DeactivateAccountAction = (_state: State, _data: FormData) => Promise<State>;

export function DeactivateAccountForm({ accountId, email, action }: { accountId: string; email: string; action: DeactivateAccountAction }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const confirmation = useRef<HTMLInputElement>(null);
  const deactivateButton = useRef<HTMLButtonElement>(null);
  const [state, formAction, pending] = useActionState(action, {});
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const openDialog = () => { confirmation.current && (confirmation.current.value = ""); setSubmitted(false); dialog.current?.showModal(); setOpen(true); requestAnimationFrame(() => confirmation.current?.focus()); };
  const closeDialog = () => { dialog.current?.close(); setOpen(false); };
  useEffect(() => { if (state.success && open && submitted) { dialog.current?.close(); deactivateButton.current?.focus(); } }, [state.success, open, submitted]);
  return <><button ref={deactivateButton} className="danger" onClick={openDialog}>Deactivate account</button>{state.success && !open && <p className="notice" role="status" tabIndex={-1}>{state.success}</p>}<dialog ref={dialog} aria-labelledby={`deactivate-${accountId}`} className="danger-dialog" onClose={() => setOpen(false)}><form action={formAction} className="sign-in-form" onSubmit={() => setSubmitted(true)}><h2 id={`deactivate-${accountId}`}>Deactivate {email}?</h2><p>Sign-in will stop immediately. Practice and first-practice records will be retained.</p><input type="hidden" name="accountId" value={accountId} /><label>Type {email} to confirm<input ref={confirmation} name="confirmation" autoComplete="off" required /></label>{state.error && open && submitted && <p role="alert" className="error">{state.error}</p>}<div className="dialog-actions"><button type="button" className="secondary" onClick={closeDialog}>Cancel</button><button className="danger" disabled={pending || !open}>{pending ? "Deactivating account..." : "Deactivate account"}</button></div></form></dialog></>;
}
