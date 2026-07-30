"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/setup", label: "Agent setup" },
  { href: "/proposals", label: "Proposals" },
  { href: "/chat", label: "Ask the analyst" },
  { href: "/activity", label: "Activity" },
  { href: "/settings", label: "Settings & safeguards" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 shrink-0 border-r border-hairline bg-surface px-3 py-5 max-md:hidden">
      <div className="px-3 pb-5">
        <div className="text-[15px] font-semibold tracking-tight">
          AI Stock Analyst
        </div>
        <div className="mt-0.5 text-xs text-ink-muted">
          Paper trading · sample data
        </div>
      </div>
      <nav className="flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-ink/[0.06] font-medium text-ink dark:bg-white/10"
                  : "text-ink-2 hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-white/5"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-hairline bg-surface px-3 py-2 md:hidden">
      {NAV.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${
              active
                ? "bg-ink/[0.06] font-medium text-ink dark:bg-white/10"
                : "text-ink-2"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
