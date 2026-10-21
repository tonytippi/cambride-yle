import Link from "next/link";
import { SignInForm } from "@/features/identity/ui/sign-in-form";
import { staffPasswordSignInEnabled } from "@/features/identity/application/auth";
import { staffSignInAction } from "./actions";

export default async function StaffSignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="shell"><section className="welcome" aria-labelledby="staff-sign-in-heading"><p className="eyebrow">Centre staff</p><h1 id="staff-sign-in-heading">Staff sign-in</h1><p>Use the Google account your centre registered for you.</p>{error === "google" && <p role="alert" className="error">We could not sign you in with Google. Check that you chose the Google account your centre registered.</p>}{/* A full-page navigation: client-side routing would fetch the route and follow its redirect to Google, which CORS blocks. */}<a className="google-button" href="/api/auth/google">Continue with Google</a>{staffPasswordSignInEnabled() && <><p className="divider">or, outside production only</p><SignInForm action={staffSignInAction} /></>}<p className="sign-in-switch"><Link href="/sign-in">Learner sign-in</Link></p></section></main>;
}
