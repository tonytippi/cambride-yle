import { requireRole } from "@/features/identity/ui/session";
import { RoleHome } from "@/features/identity/ui/home";
export default async function LearnerHome({ searchParams }: { searchParams: Promise<{ notice?: string }> }) { return <RoleHome actor={await requireRole(["learner"])} title="Your practice" notice={(await searchParams).notice} />; }
