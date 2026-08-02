import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useDocuments } from "../../hooks/useDocuments";
import { uploadDocument } from "../../services/documents";
import { fetchDriveFileBlob, isGoogleDriveConfigured, pickFileFromGoogleDrive } from "../../services/googleDrive";
import { ErrorBanner } from "../../components/ErrorBanner";
import type { DocumentStatus } from "../../types";

const STATUS_LABEL: Record<DocumentStatus, string> = {
  uploaded: "Saved",
  processing: "Processing",
  ready: "Ready",
  error: "Couldn't be processed",
};

export default function Upload() {
  const { user } = useAuth();
  const { documents } = useDocuments(user);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [driveBusy, setDriveBusy] = useState(false);

  if (!user) return null;

  async function handleFile(file: File) {
    setError(null);
    setProgress(0);
    try {
      const { documentId } = await uploadDocument(user!, file, setProgress);
      navigate(`/processing/${documentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong adding that file.");
    } finally {
      setProgress(null);
    }
  }

  async function handleGoogleDrive() {
    setError(null);
    setDriveBusy(true);
    try {
      const picked = await pickFileFromGoogleDrive();
      if (!picked) return; // cancelled
      const blob = await fetchDriveFileBlob(picked);
      await handleFile(new File([blob], picked.name, { type: picked.mimeType }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't connect to Google Drive.");
    } finally {
      setDriveBusy(false);
    }
  }

  return (
    <div>
      <h1>Add your paperwork</h1>
      <p className="gloss measure">
        Upload a PDF, take or upload a photo of your report, or connect it straight from Google Drive.
      </p>

      {error && <ErrorBanner message={error} onRetry={() => setError(null)} />}

      {documents.length > 0 && (
        <div className="card" style={{ marginBottom: "var(--sp4)" }}>
          <h2>Your documents</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {documents.map((d) => (
              <li key={d.id} className="list-row">
                <i className="ph-duotone ph-file-text" aria-hidden="true" />
                <div style={{ flex: 1 }}>
                  <Link to={`/processing/${d.id}`}>{d.fileName}</Link>
                  <p className="gloss" style={{ margin: 0 }}>
                    {STATUS_LABEL[d.status]}
                    {d.status === "error" && d.errorMessage ? ` — ${d.errorMessage}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        className={`upload-dropzone ${dragging ? "drag" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
      >
        {progress !== null ? (
          <>
            <span className="spinner" />
            <p style={{ marginTop: 12 }}>Adding your document… {progress}%</p>
            <div className="progress-bar" style={{ maxWidth: 260, margin: "12px auto" }}>
              <span style={{ width: `${progress}%` }} />
            </div>
          </>
        ) : (
          <>
            <i
              className="ph-duotone ph-upload-simple"
              style={{ fontSize: 40, color: "var(--color-accent)" }}
              aria-hidden="true"
            />
            <p style={{ margin: "12px 0" }}>Drag a PDF here, or</p>
            <div className="flex" style={{ justifyContent: "center", flexWrap: "wrap" }}>
              <button className="btn btn-solid" onClick={() => fileInputRef.current?.click()}>
                Choose a PDF file
              </button>
              <button className="btn btn-outline" onClick={() => photoInputRef.current?.click()}>
                <i className="ph-duotone ph-camera" aria-hidden="true" /> Take or upload a photo
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
          </>
        )}
      </div>

      {isGoogleDriveConfigured && (
        <>
          <div className="row-between" style={{ margin: "var(--sp4) 0" }}>
            <hr className="hair" style={{ flex: 1 }} />
            <span className="gloss">or</span>
            <hr className="hair" style={{ flex: 1 }} />
          </div>
          <button className="btn btn-outline btn-block btn-lg" onClick={handleGoogleDrive} disabled={driveBusy}>
            {driveBusy && <span className="spinner" style={{ marginRight: 8 }} />}
            <i className="ph-duotone ph-cloud-arrow-down" aria-hidden="true" /> Connect from Google Drive
          </button>
        </>
      )}
    </div>
  );
}
