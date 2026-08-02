import { useEffect, useState } from "react";
import { watchRecoveryData } from "../services/firestore";
import type { RecoveryData } from "../types";

export function useRecoveryData(uid: string | undefined, documentId: string | undefined) {
  const [data, setData] = useState<RecoveryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || !documentId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = watchRecoveryData(
      uid,
      documentId,
      (d) => {
        setData(d);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message || "Couldn't load your recovery guide.");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [uid, documentId]);

  return { data, loading, error };
}
