import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useDocuments } from "../../hooks/useDocuments";
import { watchProcessing } from "../../services/documents";
import { currentMode } from "../../services/config";
import { ErrorBanner } from "../../components/ErrorBanner";
import { ProcessingProgress } from "../../components/ProcessingProgress";

export default function Processing() {
  const { documentId } = useParams<{ documentId: string }>();
  const { user } = useAuth();
  const { documents, loading } = useDocuments(user);
  const navigate = useNavigate();
  const doc = documents.find((d) => d.id === documentId);
  const mode = currentMode();

  // Re-attach to the pipeline stream if this page was opened directly/refreshed.
  useEffect(() => {
    if (!documentId || mode !== "backend") return;
    if (doc && (doc.status === "ready" || doc.status === "error")) return;
    return watchProcessing(documentId);
  }, [documentId, mode, doc?.status]);

  useEffect(() => {
    if (doc?.status === "ready") navigate("/dashboard", { replace: true });
  }, [doc?.status, navigate]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "var(--sp8)" }}>
        <span className="spinner" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div>
        <h1>Document</h1>
        <p className="gloss">We couldn&rsquo;t find that document.</p>
        <Link to="/upload" className="btn btn-solid">
          Add your paperwork
        </Link>
      </div>
    );
  }

  if (doc.status === "error") {
    return (
      <div>
        <h1>{doc.fileName}</h1>
        <ErrorBanner
          message={doc.errorMessage ?? "We couldn't read that document."}
          onRetry={() => navigate("/upload")}
        />
      </div>
    );
  }

  // Local mode has no processing pipeline — the file is simply stored here.
  if (mode !== "backend") {
    return (
      <div>
        <h1>Document saved</h1>
        <p className="gloss measure">
          <strong>{doc.fileName}</strong> is saved on this device. Your recovery guide fills in
          automatically once the AfterCare service is connected.
        </p>
        <div className="flex" style={{ marginTop: "var(--sp4)", flexWrap: "wrap" }}>
          <Link to="/dashboard" className="btn btn-solid">
            Go to my guide
          </Link>
          <Link to="/upload" className="btn btn-outline">
            Add another document
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>Reading your document</h1>
      <p className="gloss measure">{doc.fileName}</p>
      <ProcessingProgress documentId={documentId!} />
      <p className="gloss measure" style={{ marginTop: "var(--sp3)" }}>
        Going through your paperwork and organising what it says. This usually takes under a minute.
      </p>
    </div>
  );
}
