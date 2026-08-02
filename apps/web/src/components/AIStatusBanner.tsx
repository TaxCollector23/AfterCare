import { useDocuments } from "../hooks/useDocuments";
import { useAuth } from "../hooks/useAuth";

export function AIStatusBanner() {
  const { user } = useAuth();
  const { documents } = useDocuments(user);

  // Show banner if any document failed with AI processing error
  const hasAIError = documents.some(
    (d) =>
      d.status === "error" &&
      d.errorMessage?.includes("AI processing is temporarily unavailable")
  );

  if (!hasAIError) return null;

  return (
    <div
      className="banner"
      role="alert"
      style={{
        background: "var(--color-warning)",
        borderLeft: "4px solid var(--color-warning-text)",
      }}
    >
      <i className="ph-duotone ph-lightning" aria-hidden="true" /> AI processing
      is unavailable. Check your API keys on Render or run{" "}
      <code style={{ fontSize: "0.85em", opacity: 0.8 }}>pnpm --filter @discharge-guide/api check:ai</code>
    </div>
  );
}
