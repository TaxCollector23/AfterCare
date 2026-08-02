"use client";

import * as React from "react";
import { Search, HelpCircle, Pill, Footprints, Car, UtensilsCrossed, ShowerHead, Frown } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { faqs, type FaqItem } from "@/lib/data";
import { cn } from "@/lib/utils";

const CATEGORIES: { label: FaqItem["category"] | "All"; icon: React.ElementType }[] = [
  { label: "All", icon: HelpCircle },
  { label: "Pain", icon: Frown },
  { label: "Showering", icon: ShowerHead },
  { label: "Exercise", icon: Footprints },
  { label: "Driving", icon: Car },
  { label: "Diet", icon: UtensilsCrossed },
  { label: "Medication", icon: Pill },
];

export default function QuestionsPage() {
  const [category, setCategory] = React.useState<(typeof CATEGORIES)[number]["label"]>("All");
  const [query, setQuery] = React.useState("");

  const filtered = faqs.filter((f) => {
    const matchesCategory = category === "All" || f.category === category;
    const q = query.trim().toLowerCase();
    const matchesQuery = q === "" || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q);
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="mx-auto max-w-[900px] px-6 py-8 lg:px-10 lg:py-10">
      <header className="mb-8 text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-(--color-blue-tint) text-(--color-blue)">
          <HelpCircle className="h-7 w-7" aria-hidden="true" />
        </span>
        <h1 className="text-h1">Frequently Asked Questions</h1>
        <p className="text-body text-(--color-text-secondary) mt-2">
          Answers to common recovery questions, organized by topic
        </p>
      </header>

      <div className="mb-6">
        <label htmlFor="faq-search" className="sr-only">
          Search questions
        </label>
        <div className="flex items-center gap-3 rounded-[14px] border border-(--color-border) bg-(--color-surface) px-4 py-3.5 shadow-[var(--shadow-sm)] focus-within:border-(--color-blue)">
          <Search className="h-5 w-5 text-(--color-text-tertiary)" aria-hidden="true" />
          <input
            id="faq-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions..."
            className="flex-1 bg-transparent text-body outline-none placeholder:text-(--color-text-tertiary)"
          />
        </div>
      </div>

      <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const active = category === c.label;
          return (
            <button
              key={c.label}
              onClick={() => setCategory(c.label)}
              aria-pressed={active}
              className={cn(
                "flex items-center gap-2 rounded-full border px-4 py-2.5 text-small font-medium transition-colors duration-150",
                active
                  ? "border-(--color-blue) bg-(--color-blue-tint) text-(--color-blue-dark)"
                  : "border-(--color-border) text-(--color-text-secondary) hover:border-(--color-border-strong)"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {c.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-(--color-border-strong) py-24 text-center">
          <Search className="h-12 w-12 text-(--color-text-tertiary)" aria-hidden="true" />
          <p className="text-h3">No matching questions</p>
          <p className="text-body text-(--color-text-secondary) max-w-sm">
            Try a different search term or browse another category.
          </p>
        </div>
      ) : (
        <Accordion type="multiple" className="flex flex-col gap-4">
          {filtered.map((f) => (
            <AccordionItem key={f.id} value={f.id}>
              <AccordionTrigger>
                <span className="flex flex-col gap-1">
                  <span className="text-small font-semibold text-(--color-blue) uppercase tracking-wide">
                    {f.category}
                  </span>
                  {f.question}
                </span>
              </AccordionTrigger>
              <AccordionContent>{f.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
