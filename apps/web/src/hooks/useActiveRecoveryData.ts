import { useAuth } from "./useAuth";
import { useDocuments } from "./useDocuments";
import { useRecoveryData } from "./useRecoveryData";

/** Finds the most recently processed ("ready") document and returns its recovery data,
 *  along with enough state for screens to render an honest empty/loading/error state. */
export function useActiveRecoveryData() {
  const { user } = useAuth();
  const { documents, loading: docsLoading, error: docsError } = useDocuments(user?.uid);
  const readyDoc = documents.find((d) => d.status === "ready");
  const { data, loading: dataLoading, error: dataError } = useRecoveryData(user?.uid, readyDoc?.id);

  return {
    hasAnyDocuments: documents.length > 0,
    hasReadyDocument: Boolean(readyDoc),
    hasPendingDocument: documents.some((d) => d.status === "uploaded" || d.status === "processing"),
    data,
    loading: docsLoading || (Boolean(readyDoc) && dataLoading),
    error: docsError ?? dataError,
  };
}
