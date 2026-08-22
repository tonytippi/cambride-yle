import Link from "next/link";
import { getCentreAccountDetail } from "@/features/identity/application/auth";
import { requireRole } from "@/features/identity/ui/session";
import { DeactivateAccountForm } from "@/features/identity/ui/deactivate-account-form";
import { ChangeAccountRoleForm } from "@/features/identity/ui/change-account-role-form";
import { formatAccountCreatedAt } from "@/features/identity/ui/format-account-created-at";
import { changeAccountRoleAction, deactivateAccountAction } from "../../actions";

const accountIdSchema = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NotFoundAccount = () => <main className="shell"><section className="welcome"><h1>Account not found</h1><Link href="/admin">Return to centre accounts</Link></section></main>;

export default async function AccountDetailPage({ params }: { params: Promise<{ accountId: string }> }) {
  const actor = await requireRole(["admin"]);
  const accountId = (await params).accountId;
  if (!accountIdSchema.test(accountId)) return <NotFoundAccount />;
  const detail = await getCentreAccountDetail(actor, accountId);
  if (!detail) return <NotFoundAccount />;
  const { account, history } = detail;
  return <main className="shell"><section className="welcome"><Link href="/admin">Return to centre accounts</Link><h1>{account.displayName}</h1><p>{account.email}</p><p><strong>Created:</strong> {formatAccountCreatedAt(account.createdAt)}</p><p><strong>Status:</strong> {account.status === "active" ? "Active" : `Deactivated${account.deactivatedAt ? ` on ${account.deactivatedAt.toLocaleString("en-GB")}` : ""}`}</p><p><strong>Role:</strong> {account.role.replace("_", " ")}</p><p>Practice and first-practice records are retained and do not expire.</p>{account.status === "active" && <ChangeAccountRoleForm accountId={account.id} displayName={account.displayName} role={account.role} action={changeAccountRoleAction} />}{account.status === "active" && <DeactivateAccountForm accountId={account.id} email={account.email} action={deactivateAccountAction} />}<h2>Account history</h2>{history.length ? <ol className="audit-history">{history.map((event) => <li key={event.id}>{event.action.replaceAll("_", " ").toLowerCase()} on {event.createdAt.toLocaleString("en-GB")}</li>)}</ol> : <p>No account history is available.</p>}</section></main>;
}
