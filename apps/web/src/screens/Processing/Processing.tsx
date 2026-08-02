import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useDocuments } from "../../hooks/useDocuments";
import { ErrorBanner } from "../../components/ErrorBanner";
import { isApiConfigured } from "../../services/api";

const STAGE_COPY: Record<string, string> = {
  uploaded: "Your document was received and is waiting to be processed.",
  processing: "Reading through your document and organizing what it says.",
  ready: "Done — your recovery guide is ready.",
  error: "Something went wrong while processing this document.",
};

export default function Processing() {
  const { documentId } = useParams<{ documentId: string }>();
  const { user } = useAuth();
  const { documents } = useDocuments(user?.uid);
  const navigate = useNavigate();
  const doc = documents.find((d) => d.id === documentId);

  useEffect(() => {
    if (doc?.status === "ready") navigate("/dashboard", { replace: true });
  }, [doc?.status, navigate]);

  if (!doc) {
    return (
      <div>
        <h1>Processing</h1>
        <p className="gloss">Looking for that document…</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Getting your guide ready</h1>
      <p className="gloss measure">{doc.fileName}</p>

      {doc.status === "error" ? (
        <ErrorBanner message={doc.errorMessage ?? STAGE_COPY.error} onRetry={() => navigate("/upload")} />
      ) : (
        <div className="card" style={{ textAlign: "center" }}>
          <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
          <p style={{ marginTop: 16 }}>{STAGE_COPY[doc.status] ?? "Working on it…"}</p>
        </div>
      )}

      {!isApiConfigured && doc.status !== "error" && (
        <div className="banner info" style={{ marginTop: "var(--sp4)" }}>
          <i className="ph-duotone ph-info" aria-hidden="true" /> The processing service that reads your
          document isn't connected yet. Once <code>VITE_API_BASE_URL</code> (and its backend) is set up,
          this screen will move to your recovery guide automatically as soon as it's ready.
        </div>
      )}
    </div>
  );
}
