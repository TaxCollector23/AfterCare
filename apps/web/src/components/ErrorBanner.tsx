export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="banner error" role="alert">
      <i className="ph-duotone ph-warning-circle" aria-hidden="true" /> {message}
      {onRetry && (
        <button className="btn-ghost" style={{ marginLeft: 10 }} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
