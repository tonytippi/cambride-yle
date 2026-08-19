import { requireRole } from "@/features/identity/ui/session";
import { RoleHome } from "@/features/identity/ui/home";
export default async function TeacherHome({ searchParams }: { searchParams: Promise<{ notice?: string }> }) { return <RoleHome actor={await requireRole(["teacher"])} title="Teacher workspace" notice={(await searchParams).notice} />; }
