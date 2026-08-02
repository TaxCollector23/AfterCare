import { Link } from "react-router-dom";
import { useActiveRecoveryData } from "../hooks/useActiveRecoveryData";
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

  if (hasPendingDocument) {
    return (
      <EmptyState
        icon="ph-hourglass-medium"
        title="Still processing your document"
        description="This section will fill in as soon as your document finishes processing."
        action={
          <Link to="/upload" className="btn btn-outline">
            View document status
          </Link>
        }
      />
    );
  }

  return (
    <EmptyState
      icon="ph-file-plus"
      title={hasAnyDocuments ? "No recovery guide yet" : "Add your paperwork to get started"}
      description="Upload your discharge summary or doctor's report, or connect it from Google Drive, and this section will fill in automatically."
      action={
        <Link to="/upload" className="btn btn-solid">
          Add your paperwork
        </Link>
      }
    />
  );
}
