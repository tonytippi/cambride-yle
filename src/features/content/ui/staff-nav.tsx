"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavLink = { href: string; label: string };
const staffLinks: NavLink[] = [
  { href: "/academic-lead", label: "Overview" },
  { href: "/academic-lead/content", label: "Content library" },
  { href: "/academic-lead/content/new", label: "Create content" },
  { href: "/academic-lead/sets", label: "Practice sets" },
  { href: "/academic-lead/curriculum", label: "Curriculum" },
  { href: "/academic-lead/readiness", label: "Pilot readiness" },
  { href: "/teacher", label: "Learner evidence" },
];

/* Labelled left rail on desktop; a labelled menu on narrow screens (EXPERIENCE.md navigation rule). */
export function WorkspaceNav({ label, links }: { label: string; links: NavLink[] }) {
  const pathname = usePathname();
  const current = links.filter((link) => pathname === link.href || pathname.startsWith(`${link.href}/`)).sort((left, right) => right.href.length - left.href.length)[0]?.href;
  const items = links.map((link) => <li key={link.href}><Link href={link.href} aria-current={current === link.href ? "page" : undefined}>{link.label}</Link></li>);
  return (
    <nav className="staff-nav" aria-label={label}>
      <ul className="staff-nav-rail">{items}</ul>
      <details className="staff-nav-menu">
        <summary>Menu: {links.find((link) => link.href === current)?.label ?? label}</summary>
        <ul>{items}</ul>
      </details>
    </nav>
  );
}

export function StaffNav() {
  return <WorkspaceNav label="Content workspace" links={staffLinks} />;
}
