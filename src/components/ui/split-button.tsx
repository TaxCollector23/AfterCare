"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SplitButtonOption {
  label: string;
  onSelect: () => void;
}

export function SplitButton({
  label,
  onClick,
  options,
  className,
}: {
  label: string;
  onClick: () => void;
  options: SplitButtonOption[];
  className?: string;
}) {
  return (
    <div className={cn("inline-flex isolate rounded-[14px] shadow-[var(--shadow-sm)]", className)}>
      <Button onClick={onClick} className="rounded-r-none">
        {label}
      </Button>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button
            size="icon"
            className="rounded-l-none -ml-px w-[44px] min-w-[44px] px-0"
            aria-label="More options"
          >
            <ChevronDown className="h-5 w-5" aria-hidden="true" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className="z-50 min-w-[200px] rounded-[14px] border border-(--color-border) bg-(--color-surface) p-1.5 shadow-[var(--shadow-card-hover)] animate-[dropdown-in_150ms_var(--ease-standard)]"
          >
            {options.map((opt) => (
              <DropdownMenu.Item
                key={opt.label}
                onSelect={opt.onSelect}
                className="cursor-pointer rounded-[10px] px-3 py-2.5 text-[16px] text-(--color-text-primary) outline-none hover:bg-(--color-blue-tint) focus:bg-(--color-blue-tint)"
              >
                {opt.label}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
