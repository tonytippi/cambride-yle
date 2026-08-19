import { requireRole } from "@/features/identity/ui/session";
import { RoleHome } from "@/features/identity/ui/home";
export default async function AcademicLeadHome({ searchParams }: { searchParams: Promise<{ notice?: string }> }) { return <RoleHome actor={await requireRole(["academic_lead"])} title="Academic lead workspace" notice={(await searchParams).notice} />; }
