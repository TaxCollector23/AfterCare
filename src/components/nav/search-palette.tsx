"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { Search, Pill, Calendar, HelpCircle, FileText, X } from "lucide-react";
import { medications, appointments, faqs } from "@/lib/data";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  icon: React.ReactNode;
}

function buildResults(query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: SearchResult[] = [];

  for (const m of medications) {
    if (m.name.toLowerCase().includes(q) || m.purpose.toLowerCase().includes(q)) {
      results.push({
        id: m.id,
        title: m.name,
        subtitle: m.purpose,
        href: "/medications",
        icon: <Pill className="h-5 w-5" aria-hidden="true" />,
      });
    }
  }

  for (const a of appointments) {
    if (
      a.doctor.toLowerCase().includes(q) ||
      a.specialty.toLowerCase().includes(q) ||
      a.clinic.toLowerCase().includes(q)
    ) {
      results.push({
        id: a.id,
        title: a.doctor,
        subtitle: `${a.specialty} · ${a.date}`,
        href: "/appointments",
        icon: <Calendar className="h-5 w-5" aria-hidden="true" />,
      });
    }
  }

  for (const f of faqs) {
    if (f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)) {
      results.push({
        id: f.id,
        title: f.question,
        subtitle: f.category,
        href: "/questions",
        icon: <HelpCircle className="h-5 w-5" aria-hidden="true" />,
      });
    }
  }

  if ("discharge summary".includes(q) || "documents".includes(q)) {
    results.push({
      id: "doc1",
      title: "Discharge Summary",
      subtitle: "Your original hospital paperwork, explained",
      href: "/documents",
      icon: <FileText className="h-5 w-5" aria-hidden="true" />,
    });
  }

  return results.slice(0, 8);
}

export function SearchPalette() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const results = React.useMemo(() => buildResults(query), [query]);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function updateQuery(value: string) {
    setQuery(value);
    setActiveIndex(0);
  }

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "hidden md:flex items-center gap-2.5 w-full max-w-[360px] rounded-[12px] border border-(--color-border) bg-(--color-bg) px-4 py-3 text-left",
          "text-(--color-text-tertiary) hover:border-(--color-border-strong) transition-colors duration-150"
        )}
        aria-label="Search medications, appointments, or instructions"
      >
        <Search className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="text-small flex-1 truncate">Search medications, appointments, or instructions...</span>
        <kbd className="text-small font-mono border border-(--color-border-strong) rounded-md px-1.5 py-0.5 bg-(--color-surface)">
          ⌘K
        </kbd>
      </button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 animate-[overlay-in_150ms_ease-out]" />
          <Dialog.Content
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              inputRef.current?.focus();
            }}
            className="fixed left-1/2 top-[15%] z-50 w-[92vw] max-w-[640px] -translate-x-1/2 rounded-2xl border border-(--color-border) bg-(--color-surface) shadow-[var(--shadow-card-hover)] animate-[dialog-in_180ms_var(--ease-standard)]"
          >
            <Dialog.Title className="sr-only">Search AfterCare</Dialog.Title>
            <Dialog.Description className="sr-only">
              Search medications, appointments, or instructions
            </Dialog.Description>
            <div className="flex items-center gap-3 border-b border-(--color-border) px-5 py-4">
              <Search className="h-5 w-5 text-(--color-text-tertiary)" aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => updateQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveIndex((i) => Math.min(i + 1, results.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveIndex((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter" && results[activeIndex]) {
                    go(results[activeIndex].href);
                  }
                }}
                placeholder="Search medications, appointments, or instructions..."
                className="flex-1 bg-transparent text-body outline-none placeholder:text-(--color-text-tertiary)"
                aria-label="Search"
                aria-activedescendant={results[activeIndex]?.id}
                role="combobox"
                aria-expanded={results.length > 0}
                aria-controls="search-results-list"
              />
              <Dialog.Close asChild>
                <button
                  className="rounded-lg p-1.5 text-(--color-text-tertiary) hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  aria-label="Close search"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>
            <ul id="search-results-list" role="listbox" className="max-h-[360px] overflow-y-auto p-2">
              {query.trim() === "" && (
                <li className="px-4 py-8 text-center text-(--color-text-tertiary) text-small">
                  Start typing to search your recovery guide
                </li>
              )}
              {query.trim() !== "" && results.length === 0 && (
                <li className="px-4 py-8 text-center text-(--color-text-tertiary) text-small">
                  No results for &ldquo;{query}&rdquo;
                </li>
              )}
              {results.map((r, i) => (
                <li key={r.id} id={r.id} role="option" aria-selected={i === activeIndex}>
                  <button
                    onClick={() => go(r.href)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors duration-100",
                      i === activeIndex ? "bg-(--color-blue-tint)" : "hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                    )}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-(--color-blue-tint) text-(--color-blue)">
                      {r.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-medium text-(--color-text-primary)">
                        {r.title}
                      </span>
                      <span className="block truncate text-small text-(--color-text-secondary)">{r.subtitle}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
