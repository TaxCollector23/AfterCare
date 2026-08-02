"use client";

import * as React from "react";
import * as RadixCheckbox from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  id,
  className,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: string;
  id: string;
  className?: string;
}) {
  return (
    <RadixCheckbox.Root
      id={id}
      checked={checked}
      onCheckedChange={(v) => onCheckedChange(v === true)}
      aria-label={label}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-(--color-border-strong) bg-(--color-surface)",
        "transition-colors duration-150 data-[state=checked]:bg-(--color-green) data-[state=checked]:border-(--color-green)",
        "hover:border-(--color-blue)",
        className
      )}
    >
      <RadixCheckbox.Indicator>
        <Check className="h-5 w-5 text-white" strokeWidth={3} aria-hidden="true" />
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  );
}
