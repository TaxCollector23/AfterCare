/**
 * Local-mode persistence. Used when neither the backend API nor Firebase is
 * configured, so the app is completely usable straight out of the box.
 *
 * Metadata (small JSON) lives in localStorage; uploaded file bytes live in
 * IndexedDB, which has no practical size cap — a scanned PDF easily exceeds
 * localStorage's ~5MB budget.
 */

import type { RecoveryData, UploadedDocument } from "../types";

const DOCS_KEY = "aftercare:documents";
const RECOVERY_KEY = "aftercare:recovery";
const DB_NAME = "aftercare";
const STORE = "files";

/* ------------------------------ metadata ------------------------------ */

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded — metadata is best-effort */
  }
}

const listeners = new Set<() => void>();

/** Subscribe to local-store changes (mirrors the realtime feel of Firestore). */
export function subscribeLocal(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notify() {
  listeners.forEach((cb) => cb());
}

export function listDocuments(): UploadedDocument[] {
  return readJson<UploadedDocument[]>(DOCS_KEY, []).sort((a, b) => b.createdAt - a.createdAt);
}

export function saveDocument(doc: UploadedDocument): void {
  const all = readJson<UploadedDocument[]>(DOCS_KEY, []);
  const index = all.findIndex((d) => d.id === doc.id);
  if (index >= 0) all[index] = doc;
  else all.push(doc);
  writeJson(DOCS_KEY, all);
  notify();
}

export function updateDocument(id: string, patch: Partial<UploadedDocument>): void {
  const all = readJson<UploadedDocument[]>(DOCS_KEY, []);
  const index = all.findIndex((d) => d.id === id);
  if (index < 0) return;
  all[index] = { ...all[index], ...patch, updatedAt: Date.now() };
  writeJson(DOCS_KEY, all);
  notify();
}

export function getRecovery(documentId: string): RecoveryData | null {
  const all = readJson<Record<string, RecoveryData>>(RECOVERY_KEY, {});
  return all[documentId] ?? null;
}

export function saveRecovery(data: RecoveryData): void {
  const all = readJson<Record<string, RecoveryData>>(RECOVERY_KEY, {});
  all[data.documentId] = data;
  writeJson(RECOVERY_KEY, all);
  notify();
}

/* -------------------------------- files -------------------------------- */

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB unavailable"));
  });
}

export async function putFile(id: string, file: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(file, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not save that file locally"));
  });
  db.close();
}

/** Drops a document from the local index. Used once it lives on the API. */
export function removeDocument(id: string): void {
  const all = readJson<UploadedDocument[]>(DOCS_KEY, []);
  const remaining = all.filter((d) => d.id !== id);
  if (remaining.length === all.length) return;
  writeJson(DOCS_KEY, remaining);
  notify();
}

export async function deleteFile(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not remove that file"));
  });
  db.close();
}

export async function getFile(id: string): Promise<Blob | null> {
  const db = await openDb();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => reject(req.error ?? new Error("Could not read that file"));
  });
  db.close();
  return blob;
}
