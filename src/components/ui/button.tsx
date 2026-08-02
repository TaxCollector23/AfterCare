"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-[14px] font-semibold text-[16px]",
    "transition-[background-color,box-shadow,transform,opacity,color,border-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
    "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none",
    "select-none",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: [
          "bg-(--color-blue) text-white shadow-[var(--shadow-button)]",
          "hover:bg-(--color-blue-dark) hover:shadow-[var(--shadow-button-hover)] hover:-translate-y-0.5",
          "active:translate-y-px active:shadow-[var(--shadow-sm)]",
        ].join(" "),
        secondary: [
          "bg-(--color-surface) text-(--color-text-primary) border border-(--color-border-strong) shadow-[var(--shadow-sm)]",
          "hover:bg-[#F9FAFB] dark:hover:bg-white/5 hover:-translate-y-0.5",
          "active:translate-y-px",
        ].join(" "),
        danger: [
          "bg-(--color-red) text-white shadow-[var(--shadow-button)]",
          "hover:bg-(--color-red-dark) hover:-translate-y-0.5 hover:shadow-lg",
          "active:translate-y-px",
        ].join(" "),
        success: [
          "bg-(--color-green) text-white shadow-[var(--shadow-button)]",
          "hover:bg-(--color-green-dark) hover:-translate-y-0.5 hover:shadow-lg",
          "active:translate-y-px",
        ].join(" "),
        ghost: [
          "bg-transparent text-(--color-text-primary)",
          "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]",
          "active:translate-y-px",
        ].join(" "),
      },
      size: {
        default: "min-h-[52px] px-6",
        icon: "min-h-[52px] min-w-[52px] h-[52px] w-[52px] px-0",
        sm: "min-h-[40px] px-4 text-[15px] rounded-[10px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  loadingText?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, loadingText, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
        <span>{loading && loadingText ? loadingText : children}</span>
      </button>
    );
  }
);
Button.displayName = "Button";

export function ButtonGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="group"
      className={cn(
        "inline-flex isolate rounded-[14px] shadow-[var(--shadow-sm)]",
        "[&>button]:rounded-none [&>button:first-child]:rounded-l-[14px] [&>button:last-child]:rounded-r-[14px]",
        "[&>button:not(:first-child)]:-ml-px",
        className
      )}
    >
      {children}
    </div>
  );
}

export { buttonVariants };
