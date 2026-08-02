"use client";

import * as React from "react";
import * as RadixAccordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Accordion = RadixAccordion.Root;

export function AccordionItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixAccordion.Item>) {
  return (
    <RadixAccordion.Item
      className={cn(
        "rounded-2xl border border-(--color-border) bg-(--color-surface) shadow-[var(--shadow-card)] overflow-hidden",
        className
      )}
      {...props}
    />
  );
}

export function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixAccordion.Trigger>) {
  return (
    <RadixAccordion.Header className="flex">
      <RadixAccordion.Trigger
        className={cn(
          "group flex flex-1 items-center justify-between gap-4 px-6 py-5 text-left text-h3 font-semibold",
          "transition-colors duration-150 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
          "[&[data-state=open]]:pb-3",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown
          className="h-6 w-6 shrink-0 text-(--color-text-secondary) transition-transform duration-200 group-data-[state=open]:rotate-180"
          aria-hidden="true"
        />
      </RadixAccordion.Trigger>
    </RadixAccordion.Header>
  );
}

export function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixAccordion.Content>) {
  return (
    <RadixAccordion.Content
      className={cn(
        "overflow-hidden text-body text-(--color-text-secondary)",
        "data-[state=open]:animate-[accordion-down_220ms_var(--ease-standard)]",
        "data-[state=closed]:animate-[accordion-up_220ms_var(--ease-standard)]"
      )}
      {...props}
    >
      <div className={cn("px-6 pb-6", className)}>{children}</div>
    </RadixAccordion.Content>
  );
}
