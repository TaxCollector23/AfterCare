import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import type { DocumentStatus, RecoveryData, UploadedDocument } from "../types";

function toMillis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === "number") return value;
  return Date.now();
}

function mapDocument(snap: QueryDocumentSnapshot<DocumentData>): UploadedDocument {
  const data = snap.data();
  return {
    id: snap.id,
    ownerUid: data.ownerUid,
    fileName: data.fileName,
    source: data.source,
    status: data.status,
    errorMessage: data.errorMessage,
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
    storagePath: data.storagePath,
    driveFileId: data.driveFileId,
  };
}

/** Subscribes to every document a user has uploaded, newest first. */
export function watchUserDocuments(
  uid: string,
  cb: (docs: UploadedDocument[]) => void,
  onError: (err: Error) => void
): () => void {
  const q = query(collection(db, "users", uid, "documents"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map(mapDocument)),
    (err) => onError(err as Error)
  );
}

/** Subscribes to the recovery data derived from one uploaded document, once processing has produced it. */
export function watchRecoveryData(
  uid: string,
  documentId: string,
  cb: (data: RecoveryData | null) => void,
  onError: (err: Error) => void
): () => void {
  return onSnapshot(
    doc(db, "users", uid, "documents", documentId, "recovery", "current"),
    (snap) => cb(snap.exists() ? (snap.data() as RecoveryData) : null),
    (err) => onError(err as Error)
  );
}

export async function createUploadedDocumentRecord(params: {
  uid: string;
  fileName: string;
  source: "upload" | "google-drive";
  storagePath?: string;
  driveFileId?: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, "users", params.uid, "documents"), {
    ownerUid: params.uid,
    fileName: params.fileName,
    source: params.source,
    status: "uploaded" as DocumentStatus,
    storagePath: params.storagePath ?? null,
    driveFileId: params.driveFileId ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function markDocumentStatus(
  uid: string,
  documentId: string,
  status: DocumentStatus,
  errorMessage?: string
): Promise<void> {
  await updateDoc(doc(db, "users", uid, "documents", documentId), {
    status,
    errorMessage: errorMessage ?? null,
    updatedAt: serverTimestamp(),
  });
}

export async function addCaregiverEmail(uid: string, email: string): Promise<void> {
  await setDoc(
    doc(db, "users", uid),
    { caregiverEmails: arrayUnion(email.toLowerCase()) },
    { merge: true }
  );
}
