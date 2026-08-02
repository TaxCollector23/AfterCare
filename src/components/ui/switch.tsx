"use client";

import * as React from "react";
import * as RadixSwitch from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Switch({
  checked,
  onCheckedChange,
  label,
  id,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: string;
  id: string;
}) {
  return (
    <RadixSwitch.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      className={cn(
        "relative h-8 w-14 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200",
        "bg-(--color-border-strong) data-[state=checked]:bg-(--color-blue)",
        "focus-visible:outline-2 focus-visible:outline-(--color-blue) focus-visible:outline-offset-2"
      )}
    >
      <RadixSwitch.Thumb
        className={cn(
          "block h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200",
          "translate-x-0.5 data-[state=checked]:translate-x-[26px]"
        )}
      />
    </RadixSwitch.Root>
  );
}
