import { getContentReadiness } from "@/features/content/application/content";
import { ReadinessReport } from "@/features/content/ui/readiness-report";
import { loadWorkspace } from "../workspace";

export default async function PilotReadiness() {
  const { actor, catalogue } = await loadWorkspace();
  const readiness = await getContentReadiness(actor);
  return (
    <>
      <h1>Pilot readiness</h1>
      <p>Shows whether each task engine has enough published content to compose a 5–10 minute practice set for each topic and task type.</p>
      <ReadinessReport readiness={readiness} targetLabels={new Map(catalogue.targets.map((target) => [target.id, target.canonicalId]))} />
    </>
  );
}
