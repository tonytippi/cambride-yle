import { describe, expect, it } from "vitest";
import { mediaFileFindings, mediaFileLimits, sniffMediaFile } from "@/features/content/domain/media-file";

const bytes = (...values: (number | string)[]) => Uint8Array.from(values.flatMap((value) => typeof value === "string" ? [...value].map((char) => char.charCodeAt(0)) : [value]));
const sized = (prefix: Uint8Array, size: number) => { const value = new Uint8Array(size); value.set(prefix); return value; };

describe("media file rules", () => {
  it("recognises allow-listed formats by their leading bytes", () => {
    expect(sniffMediaFile(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a))).toEqual({ kind: "image", contentType: "image/png" });
    expect(sniffMediaFile(bytes(0xff, 0xd8, 0xff, 0xe0))).toEqual({ kind: "image", contentType: "image/jpeg" });
    expect(sniffMediaFile(bytes("RIFF", 0, 0, 0, 0, "WEBP"))).toEqual({ kind: "image", contentType: "image/webp" });
    expect(sniffMediaFile(bytes("RIFF", 0, 0, 0, 0, "WAVE"))).toEqual({ kind: "audio", contentType: "audio/wav" });
    expect(sniffMediaFile(bytes("OggS"))).toEqual({ kind: "audio", contentType: "audio/ogg" });
    expect(sniffMediaFile(bytes("ID3", 4))).toEqual({ kind: "audio", contentType: "audio/mpeg" });
    expect(sniffMediaFile(bytes(0xff, 0xfb, 0x90))).toEqual({ kind: "audio", contentType: "audio/mpeg" });
    expect(sniffMediaFile(bytes(0, 0, 0, 0x20, "ftyp", "M4A "))).toEqual({ kind: "audio", contentType: "audio/mp4" });
  });

  it("rejects active or unknown formats, empty files, mismatched types and oversize files", () => {
    expect(sniffMediaFile(bytes("<svg xmlns"))).toBeUndefined();
    expect(sniffMediaFile(bytes("GIF89a"))).toBeUndefined();
    expect(mediaFileFindings("image", new Uint8Array())).toEqual([expect.objectContaining({ code: "MEDIA_FILE_EMPTY" })]);
    expect(mediaFileFindings("image", bytes("<svg xmlns"))).toEqual([expect.objectContaining({ code: "MEDIA_FILE_TYPE_UNSUPPORTED" })]);
    expect(mediaFileFindings("image", bytes("OggS"))).toEqual([expect.objectContaining({ code: "MEDIA_FILE_TYPE_MISMATCH" })]);
    expect(mediaFileFindings("image", sized(bytes(0xff, 0xd8, 0xff), mediaFileLimits.image + 1))).toEqual([expect.objectContaining({ code: "MEDIA_FILE_TOO_LARGE" })]);
    expect(mediaFileFindings("audio", sized(bytes("OggS"), mediaFileLimits.audio))).toEqual([]);
  });
});
