/**
 * One document API for the whole app, routing to whichever backing service is
 * available. Screens never branch on mode themselves.
 *
 *   backend  — bytes + AI pipeline live on the API; a local index tracks which
 *              documentIds belong to this browser (the API has no list endpoint).
 *   firebase — Firestore documents + Storage uploads.
 *   local    — IndexedDB bytes + localStorage metadata. Always available.
 */

import { currentMode } from "./config";
import * as local from "./localStore";
import {
  backendUpload,
  originalDocumentUrl,
  planToRecoveryData,
  streamProcess,
} from "./backend";
import type { AppUser } from "./session";
import type { RecoveryData, UploadedDocument } from "../types";

// Kept in step with the API's upload filter (apps/api/src/routes/upload.ts) and
// the OCR pipeline's IMAGE_MIME_TYPES. HEIC is deliberately absent: neither can
// read it, so accepting it here only moves the failure to after the upload.
// iOS Safari hands over a JPEG for both camera capture and library picks.
const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPTED = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
const ACCEPTED_EXT = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];

export function validateFile(file: File): void {
  const name = file.name.toLowerCase();
  const ok = ACCEPTED.includes(file.type) || ACCEPTED_EXT.some((e) => name.endsWith(e));
  if (!ok) throw new Error("Please choose a PDF or a photo (JPG, PNG, or WebP).");
  if (file.size > MAX_BYTES) {
    throw new Error("That file is over 20MB. Try a smaller scan or a lower-resolution photo.");
  }
}

/* ------------------------------ watching ------------------------------ */

export function watchDocuments(
  user: AppUser,
  cb: (docs: UploadedDocument[]) => void,
  onError: (message: string) => void
): () => void {
  const mode = currentMode();

  if (mode === "firebase" && !user.isLocal) {
    let cancelled = false;
    let inner: (() => void) | undefined;
    import("./firestore")
      .then(({ watchUserDocuments }) => {
        if (cancelled) return;
        inner = watchUserDocuments(user.uid, cb, (e) => onError(e.message));
      })
      .catch(() => onError("Couldn't load your documents."));
    return () => {
      cancelled = true;
      inner?.();
    };
  }

  cb(local.listDocuments());
  return local.subscribeLocal(() => cb(local.listDocuments()));
}

export function watchRecovery(
  user: AppUser,
  documentId: string | undefined,
  cb: (data: RecoveryData | null) => void,
  onError: (message: string) => void
): () => void {
  if (!documentId) {
    cb(null);
    return () => {};
  }
  const mode = currentMode();

  if (mode === "firebase" && !user.isLocal) {
    let cancelled = false;
    let inner: (() => void) | undefined;
    import("./firestore")
      .then(({ watchRecoveryData }) => {
        if (cancelled) return;
        inner = watchRecoveryData(user.uid, documentId, cb, (e) => onError(e.message));
      })
      .catch(() => onError("Couldn't load your recovery guide."));
    return () => {
      cancelled = true;
      inner?.();
    };
  }

  cb(local.getRecovery(documentId));
  return local.subscribeLocal(() => cb(local.getRecovery(documentId)));
}

/* ------------------------------ uploading ----------------------------- */

export interface UploadOutcome {
  documentId: string;
  /** True when the backend accepted it and processing has begun. */
  processing: boolean;
}

export async function uploadDocument(
  user: AppUser,
  file: File,
  onProgress: (pct: number) => void
): Promise<UploadOutcome> {
  validateFile(file);
  const mode = currentMode();
  const now = Date.now();

  if (mode === "backend" && !user.isLocal) {
    onProgress(10);
    const result = await backendUpload(file);
    onProgress(100);
    local.saveDocument({
      id: result.documentId,
      ownerUid: user.uid,
      fileName: file.name,
      source: "upload",
      status: "processing",
      createdAt: now,
      updatedAt: now,
    });
    watchProcessing(result.documentId);
    return { documentId: result.documentId, processing: true };
  }

  if (mode === "firebase" && !user.isLocal) {
    const { uploadDischargeFile } = await import("./storage");
    const { createUploadedDocumentRecord } = await import("./firestore");
    const { promise } = uploadDischargeFile(user.uid, file, onProgress);
    const { storagePath } = await promise;
    const documentId = await createUploadedDocumentRecord({
      uid: user.uid,
      fileName: file.name,
      source: "upload",
      storagePath,
    });
    return { documentId, processing: false };
  }

  // Local mode — keep the bytes in this browser.
  const documentId = crypto.randomUUID();
  onProgress(30);
  await local.putFile(documentId, file);
  onProgress(100);
  local.saveDocument({
    id: documentId,
    ownerUid: user.uid,
    fileName: file.name,
    source: "upload",
    status: "uploaded",
    createdAt: now,
    updatedAt: now,
  });
  return { documentId, processing: false };
}

/**
 * Uploads documents that were saved while the app was in local mode.
 *
 * The free API instance sleeps, and a cold start takes longer than the startup
 * probe waits — so a page load can settle into local mode even though the
 * backend exists. Anything added in that window is written to IndexedDB only,
 * and the Dashboard promises it "fills in automatically once the AfterCare
 * service is connected". Nothing used to keep that promise: the document sat
 * there forever. This is what keeps it.
 *
 * Local-mode uploads are the ones left at "uploaded" — a document the backend
 * has seen is already "processing", "ready", or "error".
 */
let migrating = false;
export async function migrateLocalDocuments(user: AppUser): Promise<number> {
  if (migrating || currentMode() !== "backend" || user.isLocal) return 0;
  const stranded = local.listDocuments().filter((d) => d.status === "uploaded");
  if (stranded.length === 0) return 0;

  migrating = true;
  let moved = 0;
  try {
    for (const doc of stranded) {
      const blob = await local.getFile(doc.id).catch(() => null);
      if (!blob) {
        // Metadata without bytes can never be recovered; say so rather than
        // leaving it looking like it is still on its way.
        local.updateDocument(doc.id, {
          status: "error",
          errorMessage: "This document's file is no longer on this device. Please add it again.",
        });
        continue;
      }
      try {
        const file = new File([blob], doc.fileName, {
          type: blob.type || "application/octet-stream",
        });
        const { documentId } = await backendUpload(file);
        // The API assigns its own id, so re-key rather than patch in place.
        local.saveDocument({
          ...doc,
          id: documentId,
          ownerUid: user.uid,
          status: "processing",
          updatedAt: Date.now(),
        });
        local.removeDocument(doc.id);
        await local.deleteFile(doc.id).catch(() => {});
        watchProcessing(documentId);
        moved += 1;
      } catch (err) {
        local.updateDocument(doc.id, {
          status: "error",
          errorMessage:
            err instanceof Error ? err.message : "We couldn't send that document for processing.",
        });
      }
    }
  } finally {
    migrating = false;
  }
  return moved;
}

/** Subscribes to backend pipeline events and mirrors them into the local index. */
export function watchProcessing(documentId: string): () => void {
  if (currentMode() !== "backend") return () => {};

  return streamProcess(documentId, {
    onEvent: () => local.updateDocument(documentId, { status: "processing" }),
    onComplete: (plan) => {
      local.saveRecovery(planToRecoveryData(plan));
      local.updateDocument(documentId, { status: "ready" });
    },
    onFailed: (message) => local.updateDocument(documentId, { status: "error", errorMessage: message }),
  });
}

/** URL or object URL for viewing the original upload. Caller revokes object URLs. */
export async function originalDocumentSrc(documentId: string): Promise<string | null> {
  if (currentMode() === "backend") return originalDocumentUrl(documentId);
  const blob = await local.getFile(documentId).catch(() => null);
  return blob ? URL.createObjectURL(blob) : null;
}
