import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-small font-semibold leading-none",
  {
    variants: {
      variant: {
        neutral: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200",
        blue: "bg-(--color-blue-tint) text-(--color-blue-dark)",
        green: "bg-(--color-green-tint) text-(--color-green-dark)",
        amber: "bg-(--color-amber-tint) text-(--color-amber-dark)",
        red: "bg-(--color-red-tint) text-(--color-red-dark)",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {children}
    </span>
  );
}
