import { requireRole } from "@/features/identity/ui/session";
import { CreateAccountForm } from "@/features/identity/ui/create-account-form";
import { SignOutButton } from "@/features/identity/ui/sign-out-button";
import { createAccountAction } from "./actions";
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) { const actor = await requireRole(["admin"]); const notice = (await searchParams).notice; return <main className="shell"><section className="welcome"><div className="home-heading"><div><p className="eyebrow">Signed in as {actor.displayName}</p><h1>Admin workspace</h1></div><SignOutButton /></div>{notice && <p className="notice" role="status">{notice}</p>}<h2>Create a centre account</h2><CreateAccountForm action={createAccountAction} /></section></main>; }
