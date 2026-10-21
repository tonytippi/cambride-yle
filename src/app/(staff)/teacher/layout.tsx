import type { ReactNode } from "react";
import { requireRole } from "@/features/identity/ui/session";
import { SignOutButton } from "@/features/identity/ui/sign-out-button";
import { WorkspaceNav, type NavLink } from "@/features/content/ui/staff-nav";

export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const actor = await requireRole(["teacher", "academic_lead", "admin"]);
  const links: NavLink[] = [
    { href: "/teacher", label: "Learner evidence" },
    { href: "/teacher/content", label: "Published content" },
    ...(actor.role === "teacher" ? [] : [{ href: "/academic-lead", label: "Content workspace" }]),
    ...(actor.role === "admin" ? [{ href: "/admin", label: "Accounts" }] : []),
  ];
  return (
    <div className="staff-shell">
      <header className="staff-header">
        <div>
          <p className="eyebrow">Staff · {actor.displayName}</p>
          <p className="staff-title">CambridgeYLE</p>
        </div>
        <SignOutButton accountId={actor.id} />
      </header>
      <WorkspaceNav label="Teacher workspace" links={links} />
      <main className="staff-main">{children}</main>
    </div>
  );
}
