import "server-only";
import { requireRole } from "@/features/identity/ui/session";
import { getCatalogue } from "@/features/curriculum/application/curriculum";
import { getContentDrafts } from "@/features/content/application/content";
import type { EditorGuidance, EditorMedia, EditorPolicy, EditorTarget } from "@/features/content/ui/content-editor";

/* Loads the staff catalogue and content library once per request and derives the editor's option lists. */
export async function loadWorkspace() {
  const actor = await requireRole(["academic_lead", "admin"]);
  const [catalogue, drafts] = await Promise.all([getCatalogue(actor), getContentDrafts(actor)]);
  const targets: EditorTarget[] = catalogue.targets.map((target) => ({ id: target.id, canonicalId: target.canonicalId, category: target.category, guidance: target.guidance, isApproved: target.isApproved }));
  const guidance: EditorGuidance[] = catalogue.guidance.map((item) => ({ id: item.id, paper: item.paper, part: item.part, engine: item.engine, topic: item.topic, taskFormat: item.taskFormat, maxWords: item.maxWords, maxOptions: item.maxOptions }));
  const policies: EditorPolicy[] = catalogue.policies.map((policy) => ({ canonicalId: policy.canonicalId, currentVersionId: policy.currentVersionId, guidanceId: policy.guidanceId }));
  const media: EditorMedia[] = drafts.media.map((item) => ({ id: item.id, mediaType: item.mediaType, status: item.status, paper: item.paper, part: item.part, engine: item.engine, description: item.description, hasFile: Boolean(item.objectKey), choiceLabel: (item.accessibilityMetadata as { choiceLabel?: string } | null)?.choiceLabel }));
  const targetName = (id: string) => catalogue.targets.find((target) => target.id === id)?.canonicalId ?? "Unknown target";
  const guidanceOf = (id: string) => catalogue.guidance.find((item) => item.id === id);
  return { actor, catalogue, drafts, targets, guidance, policies, media, targetName, guidanceOf };
}
export type Workspace = Awaited<ReturnType<typeof loadWorkspace>>;
