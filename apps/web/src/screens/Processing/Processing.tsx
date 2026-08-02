import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useDocuments } from "../../hooks/useDocuments";
import { watchProcessing } from "../../services/documents";
import { currentMode } from "../../services/config";
import { ErrorBanner } from "../../components/ErrorBanner";

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

  // An unchanging spinner reads as "stuck". After a while, say why it might be
  // slow and offer a way off the page rather than leaving people to guess.
  const [waitedLong, setWaitedLong] = useState(false);
  useEffect(() => {
    setWaitedLong(false);
    const timer = setTimeout(() => setWaitedLong(true), 45_000);
    return () => clearTimeout(timer);
  }, [documentId]);

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
      <div className="card" style={{ textAlign: "center" }}>
        <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        <p style={{ marginTop: 16 }}>
          Going through your paperwork and organising what it says. This usually takes under a minute.
        </p>
        {waitedLong && (
          <p className="gloss measure" style={{ margin: "12px auto 0" }}>
            This one is taking longer than usual — a sleeping server can add a minute
            to the first document of the day. You can safely leave this page; your
            guide will be here when it finishes.
          </p>
        )}
      </div>
      {waitedLong && (
        <div className="flex" style={{ marginTop: "var(--sp4)", flexWrap: "wrap" }}>
          <Link to="/dashboard" className="btn btn-outline">
            Go to my guide
          </Link>
          <Link to="/upload" className="btn btn-outline">
            Add a different document
          </Link>
        </div>
      )}
    </div>
  );
}
