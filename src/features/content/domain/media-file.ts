import type { ContentFindings } from "./contracts";

/* Allow-listed learner media formats, recognised by their leading bytes rather than a client-declared type. SVG and other active formats are never accepted. */
export const mediaFileLimits = { image: 5 * 1024 * 1024, audio: 15 * 1024 * 1024 } as const;
export type MediaFileKind = keyof typeof mediaFileLimits;
export type StoredMediaFile = { objectKey: string; contentType: string; byteSize: number; contentSha256: string };

const ascii = (bytes: Uint8Array, start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
export function sniffMediaFile(bytes: Uint8Array): { kind: MediaFileKind; contentType: string } | undefined {
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 4) === "PNG" && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return { kind: "image", contentType: "image/png" };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { kind: "image", contentType: "image/jpeg" };
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return { kind: "image", contentType: "image/webp" };
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WAVE") return { kind: "audio", contentType: "audio/wav" };
  if (bytes.length >= 4 && ascii(bytes, 0, 4) === "OggS") return { kind: "audio", contentType: "audio/ogg" };
  if (bytes.length >= 3 && ascii(bytes, 0, 3) === "ID3") return { kind: "audio", contentType: "audio/mpeg" };
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0) return { kind: "audio", contentType: "audio/mpeg" };
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp" && ["M4A ", "M4B ", "mp42", "isom", "dash"].includes(ascii(bytes, 8, 12))) return { kind: "audio", contentType: "audio/mp4" };
  return undefined;
}

export function mediaFileFindings(mediaType: MediaFileKind, bytes: Uint8Array): ContentFindings {
  if (!bytes.length) return [{ field: "file", code: "MEDIA_FILE_EMPTY", message: "The selected file is empty." }];
  const sniffed = sniffMediaFile(bytes);
  if (!sniffed) return [{ field: "file", code: "MEDIA_FILE_TYPE_UNSUPPORTED", message: "Use a PNG, JPEG or WebP image, or an MP3, WAV, OGG or M4A sound." }];
  if (sniffed.kind !== mediaType) return [{ field: "file", code: "MEDIA_FILE_TYPE_MISMATCH", message: `The file is ${sniffed.kind === "image" ? "an image" : "a sound"}, but the media type is ${mediaType}.` }];
  if (bytes.length > mediaFileLimits[mediaType]) return [{ field: "file", code: "MEDIA_FILE_TOO_LARGE", message: `The file is larger than ${mediaFileLimits[mediaType] / 1024 / 1024} MB.` }];
  return [];
}
