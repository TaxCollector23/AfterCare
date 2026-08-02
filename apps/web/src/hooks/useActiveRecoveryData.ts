import { useAuth } from "./useAuth";
import { useDocuments } from "./useDocuments";
import { useRecoveryData } from "./useRecoveryData";

/** Most recently processed document plus its recovery guide, with enough state
 *  for screens to render an honest loading / empty / error view. */
export function useActiveRecoveryData() {
  const { user } = useAuth();
  const { documents, loading: docsLoading, error: docsError } = useDocuments(user);
  const readyDoc = documents.find((d) => d.status === "ready");
  const { data, loading: dataLoading, error: dataError } = useRecoveryData(user, readyDoc?.id);

  return {
    hasAnyDocuments: documents.length > 0,
    hasReadyDocument: Boolean(readyDoc),
    hasPendingDocument: documents.some((d) => d.status === "uploaded" || d.status === "processing"),
    data,
    loading: docsLoading || (Boolean(readyDoc) && dataLoading),
    error: docsError ?? dataError,
  };
}
