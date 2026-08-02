import { Link } from "react-router-dom";
import { useActiveRecoveryData } from "../hooks/useActiveRecoveryData";
import { currentMode } from "../services/config";
import { EmptyState } from "./EmptyState";
import { ErrorBanner } from "./ErrorBanner";
import type { RecoveryData } from "../types";

export function RecoveryGate({ children }: { children: (data: RecoveryData) => React.ReactNode }) {
  const { data, loading, error, hasAnyDocuments, hasPendingDocument } = useActiveRecoveryData();

  if (loading) {
    return (
      <div className="card" style={{ textAlign: "center" }}>
        <span className="spinner" />
      </div>
    );
  }
  if (error) return <ErrorBanner message={error} />;
  if (data) return <>{children(data)}</>;

  // Only the backend actually processes documents. Saying "still processing" in
  // local mode would describe work that isn't happening.
  if (hasPendingDocument && currentMode() === "backend") {
    return (
      <EmptyState
        icon="ph-hourglass-medium"
        title="Still reading your document"
        description="This section will fill in as soon as your document is ready."
        action={
          <Link to="/upload" className="btn btn-outline">
            View document status
          </Link>
        }
      />
    );
  }

  if (hasAnyDocuments) {
    return (
      <EmptyState
        icon="ph-file-text"
        title="Your document is saved"
        description="Your guide fills in here automatically once the AfterCare service is connected."
        action={
          <Link to="/upload" className="btn btn-outline">
            View your documents
          </Link>
        }
      />
    );
  }

  return (
    <EmptyState
      icon="ph-file-plus"
      title="Add your paperwork to get started"
      description="Upload your discharge summary or doctor's report, take a photo of it, or connect it from Google Drive."
      action={
        <Link to="/upload" className="btn btn-solid">
          Add your paperwork
        </Link>
      }
    />
  );
}
