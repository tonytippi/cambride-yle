import Link from "next/link";
import { SignInForm } from "@/features/identity/ui/sign-in-form";
import { DeactivatedAccountCleanup } from "@/features/pwa/ui";
import { signInAction } from "./actions";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ ended?: string; account?: string }> }) {
  const { ended, account } = await searchParams;
  return <main className="shell"><section className="welcome" aria-labelledby="sign-in-heading"><p className="eyebrow">Centre access</p><h1 id="sign-in-heading">Sign in to practice</h1>{ended === "deactivated" && account && uuid.test(account) && <DeactivatedAccountCleanup accountId={account} />}<p>Use the account your centre created for you.</p><SignInForm action={signInAction} /><p className="sign-in-switch"><Link href="/staff/sign-in">Staff sign-in</Link></p></section></main>;
}
