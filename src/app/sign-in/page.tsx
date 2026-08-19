import Link from "next/link";
import { SignInForm } from "@/features/identity/ui/sign-in-form";
import { signInAction } from "./actions";

export default function SignInPage() {
  return <main className="shell"><section className="welcome" aria-labelledby="sign-in-heading"><p className="eyebrow">Centre access</p><h1 id="sign-in-heading">Sign in to practice</h1><p>Use the account your centre created for you.</p><SignInForm action={signInAction} /><p className="divider">or</p><Link className="google-button" href="/api/auth/google">Continue with Google</Link></section></main>;
}
