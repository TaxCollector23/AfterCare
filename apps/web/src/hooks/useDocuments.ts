import { useEffect, useState } from "react";
import { watchDocuments } from "../services/documents";
import type { AppUser } from "../services/session";
import type { UploadedDocument } from "../types";

export function useDocuments(user: AppUser | null) {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setDocuments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = watchDocuments(
      user,
      (docs) => {
        setDocuments(docs);
        setError(null);
        setLoading(false);
      },
      (message) => {
        setError(message);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [user]);

  return { documents, loading, error };
}
