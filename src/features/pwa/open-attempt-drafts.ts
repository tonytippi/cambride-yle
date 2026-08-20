import { isNamespacedKey, namespacedDraftKey } from "./cache-policy";

export type DraftResponse = string | boolean | number | null;
export type OpenAttemptDraft = {
  key: string;
  accountId: string;
  attemptId: string;
  setVersionId: string;
  revision: number;
  responses: Record<string, DraftResponse>;
  savedAt: number;
};

const databaseName = "cambridgeyle-open-attempt-drafts";
const storeName = "drafts";

export function isDraftResponse(value: unknown): value is DraftResponse {
  return value === null || typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value));
}

export function draftResponses(value: unknown): Record<string, DraftResponse> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return Object.entries(value).every(([key, response]) => !!key && isDraftResponse(response)) ? value as Record<string, DraftResponse> : undefined;
}

export function validDraft(draft: unknown, accountId: string, attemptId: string, setVersionId: string): draft is OpenAttemptDraft {
  if (!draft || typeof draft !== "object") return false;
  const value = draft as Partial<OpenAttemptDraft>;
  return typeof value.key === "string"
    && typeof value.accountId === "string"
    && typeof value.attemptId === "string"
    && typeof value.setVersionId === "string"
    && !!draftResponses(value.responses)
    && value.key === namespacedDraftKey(accountId, attemptId, setVersionId)
    && value.accountId === accountId
    && value.attemptId === attemptId
    && value.setVersionId === setVersionId
    && typeof value.revision === "number" && Number.isInteger(value.revision)
    && value.revision >= 0
    && isNamespacedKey(value.key, accountId)
    && typeof value.savedAt === "number" && Number.isFinite(value.savedAt) && value.savedAt > 0
    && !!draftResponses(value.responses);
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error ?? new Error("Browser storage is unavailable.")); });
}

function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("Browser storage is unavailable.")); return; }
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore(storeName, { keyPath: "key" }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Browser storage is unavailable."));
  });
}

export const openAttemptDraftStore = {
  async read(key: string) {
    const db = await database();
    try { return await requestResult(db.transaction(storeName, "readonly").objectStore(storeName).get(key)); } finally { db.close(); }
  },
  async write(draft: OpenAttemptDraft) {
    if (!validDraft(draft, draft.accountId, draft.attemptId, draft.setVersionId)) throw new Error("Invalid open-attempt draft.");
    const db = await database();
    try { await requestResult(db.transaction(storeName, "readwrite").objectStore(storeName).put(draft)); } finally { db.close(); }
  },
  async delete(key: string) {
    const db = await database();
    try { await requestResult(db.transaction(storeName, "readwrite").objectStore(storeName).delete(key)); } finally { db.close(); }
  },
  async purgeAccount(accountId: string) {
    const db = await database();
    try {
      const store = db.transaction(storeName, "readwrite").objectStore(storeName);
      const drafts = await requestResult(store.getAll()) as unknown[];
      await Promise.all(drafts.filter((draft): draft is { key: string } => !!draft && typeof draft === "object" && "key" in draft && typeof draft.key === "string" && isNamespacedKey(draft.key, accountId)).map((draft) => requestResult(store.delete(draft.key))));
    } finally { db.close(); }
  },
};

export type OpenAttemptDraftStore = typeof openAttemptDraftStore;

export function createOpenAttemptDraft(accountId: string, attemptId: string, setVersionId: string, revision: number, responses: Record<string, DraftResponse>): OpenAttemptDraft {
  return { key: namespacedDraftKey(accountId, attemptId, setVersionId), accountId, attemptId, setVersionId, revision, responses, savedAt: Date.now() };
}

export function usableDraft(draft: unknown, accountId: string, attemptId: string, setVersionId: string, revision: number) {
  return !!draft && validDraft(draft, accountId, attemptId, setVersionId) && draft.revision === revision;
}

export function sameIdentityDraft(draft: unknown, accountId: string, attemptId: string, setVersionId: string): draft is OpenAttemptDraft {
  return validDraft(draft, accountId, attemptId, setVersionId);
}

export function shouldApplyDraftHydration(hydrationEpoch: number, currentEditEpoch: number) {
  return hydrationEpoch === currentEditEpoch;
}
