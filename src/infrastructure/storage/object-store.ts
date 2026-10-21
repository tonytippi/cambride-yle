import "server-only";
import { AwsClient } from "aws4fetch";
import { serverConfig } from "@/shared/config/server";

/*
 * Private media object store. Cloudflare R2 (S3 API) is the read-write adapter. An explicit HTTPS
 * MEDIA_BINARY_ORIGIN wins and is read-only; it exists for local browser tests. Every call uses the
 * media bucket unless a bucket is named; only R2 can address another bucket (the content library).
 */
type FetchInit = NonNullable<Parameters<typeof fetch>[1]>;
/* eslint-disable no-unused-vars */
type Store = {
  url: (key: string, bucket?: string) => string;
  fetch: (url: string, init?: FetchInit) => Promise<Response>;
  writable: boolean;
};
/* eslint-enable no-unused-vars */

let cached: Store | null | undefined;
function store(): Store | null {
  if (cached !== undefined) return cached;
  const { R2_ACCESS_ENDPOINT, R2_ACCESS_KEY, R2_ACCESS_SECRET, BUCKET, MEDIA_BINARY_ORIGIN } = serverConfig;
  if (MEDIA_BINARY_ORIGIN) {
    const base = MEDIA_BINARY_ORIGIN.replace(/\/$/, "");
    cached = { url: (key) => `${base}/${encodeURIComponent(key)}`, fetch: (url, init) => fetch(url, { ...init, redirect: "error", cache: "no-store" }), writable: false };
  } else if (R2_ACCESS_ENDPOINT && R2_ACCESS_KEY && R2_ACCESS_SECRET && BUCKET) {
    const client = new AwsClient({ accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_ACCESS_SECRET, service: "s3", region: "auto" });
    const endpoint = R2_ACCESS_ENDPOINT.replace(/\/$/, "");
    cached = { url: (key, bucket = BUCKET) => `${endpoint}/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`, fetch: (url, init) => client.fetch(url, { ...init, redirect: "error", cache: "no-store" }), writable: true };
  } else cached = null;
  return cached;
}

export const isObjectStoreConfigured = () => store() !== null;
export const isObjectStoreWritable = () => store()?.writable === true;

/* The content library lives in its own bucket when one is configured, otherwise beside the media. */
export const contentLibraryBucket = () => (isObjectStoreWritable() ? serverConfig.CONTENT_LIBRARY_BUCKET ?? serverConfig.BUCKET : undefined);

export async function putObject(key: string, bytes: Uint8Array, contentType: string, bucket?: string) {
  const current = store();
  if (!current?.writable) throw new Error("OBJECT_STORE_NOT_WRITABLE");
  const response = await current.fetch(current.url(key, bucket), { method: "PUT", body: bytes as FetchInit["body"], headers: { "content-type": contentType, "content-length": String(bytes.byteLength) } });
  if (!response.ok) throw new Error(`OBJECT_STORE_PUT_FAILED_${response.status}`);
}

export async function hasObject(key: string, bucket?: string) {
  const current = store();
  if (!current) return false;
  try {
    return (await current.fetch(current.url(key, bucket), { method: "HEAD" })).ok;
  } catch {
    return false;
  }
}

export async function getObject(key: string, bucket?: string) {
  const current = store();
  if (!current) return undefined;
  try {
    const response = await current.fetch(current.url(key, bucket));
    return response.ok ? response : undefined;
  } catch {
    return undefined;
  }
}

/* Every key under a prefix (S3 ListObjectsV2), following continuation tokens. Writable R2 only. */
export async function listObjectKeys(prefix: string, bucket?: string) {
  const current = store();
  if (!current?.writable) throw new Error("OBJECT_STORE_NOT_WRITABLE");
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const query = new URLSearchParams({ "list-type": "2", prefix, ...(token && { "continuation-token": token }) });
    const response = await current.fetch(`${current.url("", bucket).replace(/\/$/, "")}?${query}`);
    if (!response.ok) throw new Error(`OBJECT_STORE_LIST_FAILED_${response.status}`);
    const xml = await response.text();
    for (const match of xml.matchAll(/<Key>([^<]*)<\/Key>/g)) keys.push(decodeXml(match[1]!));
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? decodeXml(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/.exec(xml)?.[1] ?? "") || undefined : undefined;
  } while (token);
  return keys;
}
const decodeXml = (value: string) => value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
