import { useEffect, useState } from "react";
import { watchRecovery } from "../services/documents";
import type { AppUser } from "../services/session";
import type { RecoveryData } from "../types";

export function useRecoveryData(user: AppUser | null, documentId: string | undefined) {
  const [data, setData] = useState<RecoveryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !documentId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = watchRecovery(
      user,
      documentId,
      (d) => {
        setData(d);
        setError(null);
        setLoading(false);
      },
      (message) => {
        setError(message);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [user, documentId]);

  return { data, loading, error };
}
