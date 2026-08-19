import type { Actor } from "../domain/contracts";
import { SignOutButton } from "./sign-out-button";

export function RoleHome({ actor, title, notice }: { actor: Actor; title: string; notice?: string }) {
  return <main className="shell"><section className="welcome"><div className="home-heading"><div><p className="eyebrow">Signed in as {actor.displayName}</p><h1>{title}</h1></div><SignOutButton /></div>{notice && <p className="notice" role="status">{notice}</p>}<p>Your centre workspace is ready. More role-specific tools will appear here.</p></section></main>;
}
