import "server-only";
import { contentLibraryBucket, getObject, hasObject, listObjectKeys, putObject } from "@/infrastructure/storage/object-store";
import { mediaFileKey } from "../domain/records";

/* eslint-disable no-unused-vars */
export type LibraryStore = {
  listKeys: (prefix: string) => Promise<string[]>;
  readText: (key: string) => Promise<string | undefined>;
  writeText: (key: string, text: string) => Promise<void>;
  /* Copies a content-addressed media binary between the media bucket (`media/<sha>`) and the library. */
  copyMedia: (direction: "to_library" | "from_library", sha256: string, contentType: string) => Promise<"copied" | "present" | "missing">;
};
/* eslint-enable no-unused-vars */

export class ContentLibraryError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/* The R2 adapter; the library is unavailable when the object store is read-only or absent. */
export function r2LibraryStore(): LibraryStore {
  const bucket = contentLibraryBucket();
  if (!bucket) throw new ContentLibraryError("CONTENT_LIBRARY_NOT_CONFIGURED", "The content library needs a writable R2 bucket.");
  return {
    listKeys: (prefix) => listObjectKeys(prefix, bucket),
    readText: async (key) => (await getObject(key, bucket))?.text(),
    writeText: (key, text) => putObject(key, new TextEncoder().encode(text), "application/json", bucket),
    copyMedia: async (direction, sha256, contentType) => {
      const [source, target] = direction === "to_library" ? [{ key: `media/${sha256}` }, { key: mediaFileKey(sha256), bucket }] : [{ key: mediaFileKey(sha256), bucket }, { key: `media/${sha256}` }];
      if (await hasObject(target.key, target.bucket)) return "present";
      const response = await getObject(source.key, "bucket" in source ? source.bucket : undefined);
      if (!response) return "missing";
      await putObject(target.key, new Uint8Array(await response.arrayBuffer()), contentType, "bucket" in target ? target.bucket : undefined);
      return "copied";
    },
  };
}
