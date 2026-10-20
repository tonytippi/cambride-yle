import { createHash } from "node:crypto";
import { hasObject, isObjectStoreWritable, putObject } from "@/infrastructure/storage/object-store";
import { mediaFileFindings, sniffMediaFile, type MediaFileKind, type StoredMediaFile } from "../domain/media-file";
import { ContentError } from "./shared";

export type MediaUpload = { bytes: Uint8Array };

/* Stores an allow-listed file under a content-addressed key; identical bytes share one object, so retries are idempotent. */
export async function storeMediaFile(mediaType: MediaFileKind, upload: MediaUpload): Promise<StoredMediaFile> {
  const findings = mediaFileFindings(mediaType, upload.bytes);
  if (findings.length) throw new ContentError("VALIDATION_FAILED", "Check the named validation findings.", findings);
  if (!isObjectStoreWritable()) throw new ContentError("MEDIA_STORE_NOT_CONFIGURED", "Media file storage is not configured.");
  const contentSha256 = createHash("sha256").update(upload.bytes).digest("hex");
  const objectKey = `media/${contentSha256}`;
  const { contentType } = sniffMediaFile(upload.bytes)!;
  try {
    if (!(await hasObject(objectKey))) await putObject(objectKey, upload.bytes, contentType);
  } catch {
    throw new ContentError("MEDIA_STORE_UNAVAILABLE", "The media file could not be stored. Try again.");
  }
  return { objectKey, contentType, byteSize: upload.bytes.byteLength, contentSha256 };
}

/* A revision without a new upload keeps the source version's immutable object. */
export const storedFileOf = (media: { objectKey?: string | null; contentType?: string | null; byteSize?: number | null; contentSha256?: string | null } | undefined): StoredMediaFile | undefined =>
  media?.objectKey && media.contentType && media.byteSize && media.contentSha256 ? { objectKey: media.objectKey, contentType: media.contentType, byteSize: media.byteSize, contentSha256: media.contentSha256 } : undefined;
