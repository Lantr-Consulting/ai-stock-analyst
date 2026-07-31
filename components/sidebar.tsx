"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const NAV = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <Icon>
        <path d="M3 3v18h18" />
        <path d="m7 14 4-4 3 3 5-6" />
      </Icon>
    ),
  },
  {
    href: "/setup",
    label: "Agent setup",
    icon: (
      <Icon>
        <line x1="4" y1="21" x2="4" y2="13" />
        <line x1="4" y1="9" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="13" />
        <line x1="12" y1="9" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="13" />
        <line x1="20" y1="9" x2="20" y2="3" />
        <line x1="2" y1="11" x2="6" y2="11" />
        <line x1="10" y1="11" x2="14" y2="11" />
        <line x1="18" y1="11" x2="22" y2="11" />
      </Icon>
    ),
  },
  {
    href: "/proposals",
    label: "Proposals",
    icon: (
      <Icon>
        <polyline points="9 11 12 14 21 5" />
        <path d="M21 12v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11" />
      </Icon>
    ),
  },
  {
    href: "/chat",
    label: "Ask the analyst",
    icon: (
      <Icon>
        <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3a8.5 8.5 0 0 1 8.5 8.5Z" />
      </Icon>
    ),
  },
  {
    href: "/activity",
    label: "Activity",
    icon: (
      <Icon>
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </Icon>
    ),
  },
  {
    href: "/settings",
    label: "Settings & safeguards",
    icon: (
      <Icon>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </Icon>
    ),
  },
];

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5 px-3 pb-6 pt-1">
      <span className="flex size-7 items-center justify-center rounded-lg bg-series-1">
        <svg
          aria-hidden
          viewBox="0 0 32 32"
          className="size-4"
          fill="none"
          stroke="#fff"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 22l7-7 4 4 9-10" />
        </svg>
      </span>
      <span>
        <span className="block text-[15px] font-semibold leading-tight tracking-tight">
          AI Stock Analyst
        </span>
        <span className="block text-[11px] leading-tight text-ink-muted">
          Paper trading · sample data
        </span>
      </span>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-hairline bg-surface px-3 py-5 max-md:hidden">
      <Wordmark />
      <nav className="flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-series-1 ${
                active
                  ? "bg-ink/[0.06] font-medium text-ink dark:bg-white/10"
                  : "text-ink-2 hover:bg-ink/[0.04] hover:text-ink dark:hover:bg-white/5"
              }`}
            >
              <span className={active ? "text-series-1" : "text-ink-muted"}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-3 px-3">
        <AccountBox />
        <div className="text-[11px] leading-relaxed text-ink-muted">
          A Lantr sample project.
          <br />
          Simulated — not financial advice.
        </div>
      </div>
    </aside>
  );
}

function AccountBox() {
  const [email, setEmail] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (email === undefined) return null;

  if (email === null) {
    return (
      <Link
        href="/signin"
        className="rounded-lg border border-hairline px-3 py-2 text-center text-sm font-medium text-ink-2 hover:bg-ink/[0.04] dark:hover:bg-white/5"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="rounded-lg border border-hairline px-3 py-2">
      <div className="truncate text-xs font-medium">{email}</div>
      <button
        onClick={() => supabase.auth.signOut().then(() => window.location.assign("/"))}
        className="mt-0.5 text-xs text-ink-muted hover:text-ink"
      >
        Sign out
      </button>
    </div>
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
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${
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
