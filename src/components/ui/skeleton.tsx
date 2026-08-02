import { cn } from "@/lib/utils";

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-(--color-border)", className)}
      style={style}
      aria-hidden="true"
    />
  );
}

export function DocumentSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" role="status" aria-label="Loading your document">
      {[0, 1].map((col) => (
        <div key={col} className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-6 sm:p-8 flex flex-col gap-4">
          <Skeleton className="h-5 w-1/2" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" style={{ width: `${85 - i * 6}%` }} />
          ))}
        </div>
      ))}
      <span className="sr-only">Loading your document…</span>
    </div>
  );
}
