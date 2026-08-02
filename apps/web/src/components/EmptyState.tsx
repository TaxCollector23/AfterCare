export function EmptyState({
  icon = "ph-file-dashed",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state" role="status">
      <i className={`ph-duotone ${icon}`} aria-hidden="true" />
      <h3>{title}</h3>
      {description && <p className="gloss measure">{description}</p>}
      {action}
    </div>
  );
}
