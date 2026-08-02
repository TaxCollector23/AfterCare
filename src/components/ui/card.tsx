import * as React from "react";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  as?: React.ElementType;
}

export function Card({ className, interactive, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-(--color-border) bg-(--color-surface) p-6 shadow-[var(--shadow-card)]",
        "transition-[box-shadow,transform] duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
        interactive &&
          "cursor-pointer hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5 focus-visible:shadow-[var(--shadow-card-hover)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-h3 text-(--color-text-primary)", className)} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-small text-(--color-text-secondary)", className)} {...props}>
      {children}
    </p>
  );
}
