import "server-only";
import { AwsClient } from "aws4fetch";
import { serverConfig } from "@/shared/config/server";

/*
 * Private media object store. Cloudflare R2 (S3 API) is the read-write adapter. An explicit HTTPS
 * MEDIA_BINARY_ORIGIN wins and is read-only; it exists for local browser tests.
 */
type FetchInit = NonNullable<Parameters<typeof fetch>[1]>;
/* eslint-disable no-unused-vars */
type Store = {
  url: (key: string) => string;
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
    const base = `${R2_ACCESS_ENDPOINT.replace(/\/$/, "")}/${BUCKET}`;
    cached = { url: (key) => `${base}/${key.split("/").map(encodeURIComponent).join("/")}`, fetch: (url, init) => client.fetch(url, { ...init, redirect: "error", cache: "no-store" }), writable: true };
  } else cached = null;
  return cached;
}

export const isObjectStoreConfigured = () => store() !== null;
export const isObjectStoreWritable = () => store()?.writable === true;

export async function putObject(key: string, bytes: Uint8Array, contentType: string) {
  const current = store();
  if (!current?.writable) throw new Error("OBJECT_STORE_NOT_WRITABLE");
  const response = await current.fetch(current.url(key), { method: "PUT", body: bytes as FetchInit["body"], headers: { "content-type": contentType, "content-length": String(bytes.byteLength) } });
  if (!response.ok) throw new Error(`OBJECT_STORE_PUT_FAILED_${response.status}`);
}

export async function hasObject(key: string) {
  const current = store();
  if (!current) return false;
  try {
    return (await current.fetch(current.url(key), { method: "HEAD" })).ok;
  } catch {
    return false;
  }
}

export async function getObject(key: string) {
  const current = store();
  if (!current) return undefined;
  try {
    const response = await current.fetch(current.url(key));
    return response.ok ? response : undefined;
  } catch {
    return undefined;
  }
}
