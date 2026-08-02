import { useEffect, useState } from "react";
import { watchUserDocuments } from "../services/firestore";
import type { UploadedDocument } from "../types";

export function useDocuments(uid: string | undefined) {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setDocuments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = watchUserDocuments(
      uid,
      (docs) => {
        setDocuments(docs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message || "Couldn't load your documents.");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [uid]);

  return { documents, loading, error };
}
