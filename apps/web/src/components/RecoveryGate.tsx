import { Link } from "react-router-dom";
import { useActiveRecoveryData } from "../hooks/useActiveRecoveryData";
import { currentMode } from "../services/config";
import { EmptyState } from "./EmptyState";
import { ErrorBanner } from "./ErrorBanner";
import type { RecoveryData } from "../types";

type RecoveryEmptyState = {
  icon: string;
  title: string;
  description: string;
};

export function RecoveryGate({
  children,
  emptyState,
}: {
  children: (data: RecoveryData) => React.ReactNode;
  emptyState?: RecoveryEmptyState;
}) {
  const { data, loading, error, hasAnyDocuments, hasPendingDocument } =
    useActiveRecoveryData();

  if (loading) {
    return (
      <div className="card" style={{ textAlign: "center" }}>
        <span className="spinner" />
      </div>
    );
  }
  if (error) return <ErrorBanner message={error} />;
  if (data) return <>{children(data)}</>;

  // The dashboard owns onboarding. Other destinations describe their own
  // empty content without repeating the same upload call to action.
  if (emptyState) {
    const isActivelyProcessing =
      hasPendingDocument && currentMode() === "backend";
    return (
      <EmptyState
        icon={emptyState.icon}
        title={
          isActivelyProcessing ? "Preparing this section" : emptyState.title
        }
        description={
          isActivelyProcessing
            ? "This section will fill in automatically when your document is ready."
            : emptyState.description
        }
      />
    );
  }

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
      title="Build your recovery guide"
      description="Add a discharge summary or doctor's report once, and AfterCare will organize the details here."
      action={
        <Link to="/upload" className="btn btn-solid">
          Add a document
        </Link>
      }
    />
  );
}
