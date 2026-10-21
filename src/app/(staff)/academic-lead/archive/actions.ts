"use server";
import { revalidatePath } from "next/cache";
import { currentActor } from "@/features/identity/ui/session";
import { importFromLibrary, type ImportReport } from "@/features/content-library/application/import";
import { pushAllToLibrary, type PushReport } from "@/features/content-library/application/sync";

export type ArchiveActionState = { error?: { code: string; message: string }; success?: string; importReport?: ImportReport; pushReport?: PushReport };
const failure = (error: unknown): ArchiveActionState => ({
  error: error instanceof Error && "code" in error ? { code: String((error as { code: unknown }).code), message: error.message } : { code: "CONTENT_LIBRARY_FAILED", message: "The content library could not be reached. Try again." },
});
const actorFor = async () => {
  const actor = await currentActor();
  if (!actor) throw Object.assign(new Error("You do not have access to that page."), { code: "FORBIDDEN" });
  return actor;
};

export async function importFromLibraryAction(_: ArchiveActionState, formData: FormData): Promise<ArchiveActionState> {
  try {
    const input = formData.get("intent") === "all" ? { all: true as const } : { practiceSetIds: formData.getAll("practiceSetIds").map(String) };
    const report = await importFromLibrary(await actorFor(), input);
    revalidatePath("/academic-lead", "layout");
    return { success: `Imported ${report.imported.length}, already here ${report.present.length}, failed ${report.failed.length}.`, importReport: report };
  } catch (error) {
    return failure(error);
  }
}

export async function pushAllToLibraryAction(): Promise<ArchiveActionState> {
  try {
    const report = await pushAllToLibrary(await actorFor());
    revalidatePath("/academic-lead/archive");
    return { success: `Pushed to the library: ${report.written} updated, ${report.unchanged} unchanged, ${report.mediaCopied} media files copied, ${report.failed.length} failed.`, pushReport: report };
  } catch (error) {
    return failure(error);
  }
}
