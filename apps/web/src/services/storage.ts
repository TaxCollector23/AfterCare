import { getDownloadURL, ref, uploadBytesResumable, type UploadTaskSnapshot } from "firebase/storage";
import { storage } from "../firebase";

export class UnsupportedFileError extends Error {
  constructor() {
    super("Please upload a PDF or a photo (JPG, PNG, or HEIC).");
    this.name = "UnsupportedFileError";
  }
}

export class FileTooLargeError extends Error {
  constructor() {
    super("That file is larger than 20MB. Try a smaller scan, fewer pages, or a lower-resolution photo.");
    this.name = "FileTooLargeError";
  }
}

const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/heic", "image/heif", "image/webp"];
const ACCEPTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp"];

export function validateFile(file: File): void {
  const nameLower = file.name.toLowerCase();
  const typeOk = ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXTENSIONS.some((ext) => nameLower.endsWith(ext));
  if (!typeOk) throw new UnsupportedFileError();
  if (file.size > MAX_BYTES) throw new FileTooLargeError();
}

/** Uploads a discharge document to Firebase Storage under the user's own folder. */
export function uploadDischargeFile(
  uid: string,
  file: File,
  onProgress: (pct: number) => void
): { promise: Promise<{ storagePath: string; downloadUrl: string }>; cancel: () => void } {
  validateFile(file);
  const storagePath = `users/${uid}/documents/${Date.now()}-${file.name}`;
  const task = uploadBytesResumable(ref(storage, storagePath), file, {
    contentType: file.type || "application/octet-stream",
  });

  const promise = new Promise<{ storagePath: string; downloadUrl: string }>((resolve, reject) => {
    task.on(
      "state_changed",
      (snap: UploadTaskSnapshot) => onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err) => reject(mapUploadError(err)),
      async () => {
        const downloadUrl = await getDownloadURL(task.snapshot.ref);
        resolve({ storagePath, downloadUrl });
      }
    );
  });

  return { promise, cancel: () => task.cancel() };
}

function mapUploadError(err: unknown): Error {
  const code = (err as { code?: string })?.code ?? "";
  if (code === "storage/unauthorized") {
    return new Error("Upload was blocked by security rules. Make sure you're signed in and try again.");
  }
  if (code === "storage/canceled") {
    return new Error("Upload canceled.");
  }
  if (code === "storage/quota-exceeded") {
    return new Error("Storage quota exceeded for this project. Contact whoever set up AfterCare.");
  }
  return new Error("The upload failed. Check your connection and try again.");
}
