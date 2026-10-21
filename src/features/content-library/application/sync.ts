import "server-only";
import { after } from "next/server";
import { authorise } from "@/features/identity/application/auth";
import type { Actor } from "@/features/identity/domain/contracts";
import { contentLibraryBucket } from "@/infrastructure/storage/object-store";
import { libraryPrefix, mediaFileKey, mergeForPush, parseRecord, recordKey, serialiseRecord } from "../domain/records";
import { r2LibraryStore, type LibraryStore } from "../infrastructure/library-store";
import { loadExportRecords } from "../infrastructure/repositories";

/* What this process last saw in the library, so a routine push only reads and writes changed files. */
const known = new Map<string, string>();

export type PushReport = { written: number; unchanged: number; mediaCopied: number; failed: { key: string; message: string }[] };

/* Mirrors every curriculum record, content version and practice set from the database into the library. */
export async function pushToLibrary(options: { store?: LibraryStore; fresh?: boolean } = {}): Promise<PushReport> {
  const store = options.store ?? r2LibraryStore();
  if (options.fresh) known.clear();
  const records = await loadExportRecords();
  const keys = new Set(await store.listKeys(libraryPrefix));
  const report: PushReport = { written: 0, unchanged: 0, mediaCopied: 0, failed: [] };
  for (const record of records) {
    const key = recordKey(record);
    try {
      const cached = known.get(key);
      if (cached !== undefined && keys.has(key) && serialiseRecord(mergeForPush(parseRecord(cached), record)) === cached) {
        report.unchanged += 1;
      } else {
        const current = keys.has(key) ? await store.readText(key) : undefined;
        const text = serialiseRecord(mergeForPush(current === undefined ? undefined : parseRecord(current), record));
        if (text === current) report.unchanged += 1;
        else {
          await store.writeText(key, text);
          report.written += 1;
        }
        known.set(key, text);
      }
      if (record.kind === "media" && record.file && !keys.has(mediaFileKey(record.file.contentSha256)) && !known.has(mediaFileKey(record.file.contentSha256))) {
        const copied = await store.copyMedia("to_library", record.file.contentSha256, record.file.contentType);
        if (copied === "missing") report.failed.push({ key: mediaFileKey(record.file.contentSha256), message: "The media file is missing from the media bucket." });
        else {
          known.set(mediaFileKey(record.file.contentSha256), "");
          if (copied === "copied") report.mediaCopied += 1;
        }
      }
    } catch (error) {
      report.failed.push({ key, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return report;
}

/* Staff "Push all to library": rereads the whole library instead of trusting this process's cache. */
export async function pushAllToLibrary(actor: Actor, store?: LibraryStore) {
  authorise(actor, ["academic_lead", "admin"]);
  return pushToLibrary({ store, fresh: true });
}

let running: Promise<void> | undefined;
let pending = false;
async function drain() {
  do {
    pending = false;
    try {
      const report = await pushToLibrary();
      if (report.failed.length) console.error("CONTENT_LIBRARY_PUSH_FAILED", report.failed);
    } catch (error) {
      console.error("CONTENT_LIBRARY_PUSH_FAILED", error instanceof Error ? error.message : error);
    }
  } while (pending);
}

/* Called after a successful content or curriculum change; the push runs after the response and never fails the change. */
export function scheduleLibraryPush() {
  if (!contentLibraryBucket()) return;
  after(async () => {
    if (running) {
      pending = true;
      return running;
    }
    running = drain().finally(() => {
      running = undefined;
    });
    return running;
  });
}
