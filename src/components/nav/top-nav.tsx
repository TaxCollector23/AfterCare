"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { HeartPulse, Bell, ChevronDown, Settings, LogOut, User } from "lucide-react";
import { SearchPalette } from "@/components/nav/search-palette";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Recovery Guide" },
  { href: "/medications", label: "Medications" },
  { href: "/appointments", label: "Appointments" },
  { href: "/documents", label: "Documents" },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-(--color-border) bg-(--color-surface)/85 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-[1400px] items-center gap-6 px-6 lg:px-10">
        <Link
          href="/"
          className="flex items-center gap-2.5 shrink-0 font-bold text-h3 text-(--color-text-primary) rounded-lg"
          aria-label="AfterCare home"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-(--color-blue) text-white">
            <HeartPulse className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="hidden sm:inline">AfterCare</span>
        </Link>

        <nav aria-label="Main navigation" className="hidden lg:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-[10px] px-4 py-2.5 text-small font-medium transition-colors duration-150",
                  active
                    ? "bg-(--color-blue-tint) text-(--color-blue-dark)"
                    : "text-(--color-text-secondary) hover:bg-black/[0.03] hover:text-(--color-text-primary) dark:hover:bg-white/[0.05]"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1 flex justify-center lg:justify-start max-w-[420px]">
          <SearchPalette />
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <Link
            href="/questions"
            className="hidden md:inline-flex rounded-[10px] px-4 py-2.5 text-small font-medium text-(--color-text-secondary) hover:bg-black/[0.03] hover:text-(--color-text-primary) dark:hover:bg-white/[0.05] transition-colors duration-150"
          >
            Questions
          </Link>

          <button
            type="button"
            className="relative flex h-11 w-11 items-center justify-center rounded-[10px] text-(--color-text-secondary) hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors duration-150"
            aria-label="Notifications, 2 unread"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
            <span
              className="absolute top-2 right-2 h-2 w-2 rounded-full bg-(--color-red) ring-2 ring-(--color-surface)"
              aria-hidden="true"
            />
          </button>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                className="flex items-center gap-2 rounded-[10px] py-1.5 pl-1.5 pr-2.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors duration-150"
                aria-label="Profile menu for Sarah Chen"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-(--color-purple-tint) text-(--color-purple) font-semibold text-small">
                  SC
                </span>
                <ChevronDown className="h-4 w-4 text-(--color-text-tertiary)" aria-hidden="true" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={10}
                className="z-50 min-w-[220px] rounded-[14px] border border-(--color-border) bg-(--color-surface) p-1.5 shadow-[var(--shadow-card-hover)] animate-[dropdown-in_150ms_var(--ease-standard)]"
              >
                <div className="px-3 py-2.5">
                  <p className="text-body font-semibold">Sarah Chen</p>
                  <p className="text-small text-(--color-text-secondary)">Patient ID #48213</p>
                </div>
                <DropdownMenu.Separator className="my-1 h-px bg-(--color-border)" />
                <DropdownMenu.Item asChild>
                  <Link
                    href="/settings"
                    className="flex items-center gap-2.5 cursor-pointer rounded-[10px] px-3 py-2.5 text-body outline-none hover:bg-(--color-blue-tint) focus:bg-(--color-blue-tint)"
                  >
                    <Settings className="h-4 w-4" aria-hidden="true" />
                    Settings
                  </Link>
                </DropdownMenu.Item>
                <DropdownMenu.Item className="flex items-center gap-2.5 cursor-pointer rounded-[10px] px-3 py-2.5 text-body outline-none hover:bg-(--color-blue-tint) focus:bg-(--color-blue-tint)">
                  <User className="h-4 w-4" aria-hidden="true" />
                  My Profile
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-(--color-border)" />
                <DropdownMenu.Item className="flex items-center gap-2.5 cursor-pointer rounded-[10px] px-3 py-2.5 text-body text-(--color-red) outline-none hover:bg-(--color-red-tint) focus:bg-(--color-red-tint)">
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign Out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      <nav aria-label="Mobile navigation" className="flex lg:hidden overflow-x-auto gap-1 px-4 pb-3">
        {[...NAV_LINKS, { href: "/questions", label: "Questions" }, { href: "/settings", label: "Settings" }].map(
          (link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-[10px] px-3.5 py-2 text-small font-medium transition-colors duration-150",
                  active
                    ? "bg-(--color-blue-tint) text-(--color-blue-dark)"
                    : "text-(--color-text-secondary) hover:bg-black/[0.03]"
                )}
              >
                {link.label}
              </Link>
            );
          }
        )}
      </nav>
    </header>
  );
}
