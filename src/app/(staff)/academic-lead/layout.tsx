import type { ReactNode } from "react";
import { requireRole } from "@/features/identity/ui/session";
import { SignOutButton } from "@/features/identity/ui/sign-out-button";
import { StaffNav } from "@/features/content/ui/staff-nav";

export default async function AcademicLeadLayout({ children }: { children: ReactNode }) {
  const actor = await requireRole(["academic_lead", "admin"]);
  return (
    <div className="staff-shell">
      <header className="staff-header">
        <div>
          <p className="eyebrow">Internal staff workspace · {actor.displayName}</p>
          <p className="staff-title">CambridgeYLE content</p>
        </div>
        <SignOutButton accountId={actor.id} />
      </header>
      <StaffNav extraLinks={actor.role === "admin" ? [{ href: "/admin", label: "Accounts" }] : []} />
      <main className="staff-main">{children}</main>
    </div>
  );
}
