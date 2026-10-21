import { requireRole } from "@/features/identity/ui/session";
import { getContentArchive } from "@/features/content-library/application/import";
import { ContentLibraryError } from "@/features/content-library/infrastructure/library-store";
import { ArchivePanel } from "@/features/content-library/ui/archive-panel";
import { importFromLibraryAction, pushAllToLibraryAction } from "./actions";

export default async function ContentArchive() {
  const actor = await requireRole(["academic_lead", "admin"]);
  let archive: Awaited<ReturnType<typeof getContentArchive>> | undefined;
  let unavailable: string | undefined;
  try {
    archive = await getContentArchive(actor);
  } catch (error) {
    unavailable = error instanceof ContentLibraryError ? error.message : "The content library could not be reached. Try again later.";
  }
  return (
    <>
      <h1>Content archive</h1>
      <p>The archive keeps every lesson version and its status in shared storage, so content survives a database reset and can move between environments. Changes are pushed automatically after each save.</p>
      {unavailable ? <p role="alert" className="error">{unavailable}</p> : <ArchivePanel archive={archive!} importAction={importFromLibraryAction} pushAction={pushAllToLibraryAction} />}
    </>
  );
}
