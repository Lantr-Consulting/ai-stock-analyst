"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getDecisions } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { pick, useLanguage } from "@/lib/language";
import { supabase } from "@/lib/supabase";
import type { Decision } from "@/lib/types";
import { LanguageToggle } from "@/components/language-toggle";

const PRIMARY_NAV = [
  { href: "/dashboard", zh: "投资组合", en: "Portfolio" },
  { href: "/discover", zh: "发现机会", en: "Discover" },
  { href: "/chat", zh: "研究助手", en: "Research" },
  { href: "/automations", zh: "定时任务", en: "Automations" },
] as const;

const MOBILE_NAV = [
  ...PRIMARY_NAV,
  { href: "/setup", zh: "投资偏好", en: "Investor profile" },
  { href: "/settings", zh: "设置与风控", en: "Safeguards" },
] as const;

function Wordmark() {
  const language = useLanguage();
  return (
    <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5" aria-label="AI Stock Analyst">
      <span className="flex size-8 items-center justify-center rounded-xl bg-accent">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/lantr_mark.png" alt="" className="size-[18px]" />
      </span>
      <span className="leading-none">
        <span className="block text-[16px] font-semibold tracking-tight">AI Stock Analyst</span>
        <span className="mt-1 hidden text-[10px] font-medium text-ink-muted xl:block">
          {pick(language, "有依据的投资研究", "Evidence-led investment research")}
        </span>
      </span>
    </Link>
  );
}

function ThemeToggle() {
  const language = useLanguage();
  const [theme, setTheme] = useState<"dark" | "light" | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() =>
      setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark"),
    );
    return () => cancelAnimationFrame(id);
  }, []);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    if (next === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={pick(language, "切换深色或浅色模式", "Toggle light or dark mode")}
      className="flex size-8 items-center justify-center rounded-full border border-hairline text-ink-2 transition-colors hover:bg-ink/10 hover:text-ink"
    >
      {theme === null ? null : theme === "dark" ? (
        <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}

function AccountControl() {
  const language = useLanguage();
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  if (email === undefined) return <span aria-hidden className="size-8 rounded-full border border-hairline" />;

  if (email === null) {
    return (
      <Link href="/signin" className="btn-ghost h-8 gap-1.5 px-3 text-xs">
        <svg aria-hidden viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <circle cx="12" cy="8" r="4" />
          <path d="M5 21a7 7 0 0 1 14 0" />
        </svg>
        <span className="hidden sm:inline">{pick(language, "登录", "Sign in")}</span>
      </Link>
    );
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={pick(language, "账户菜单", "Account menu")} className="flex size-8 items-center justify-center rounded-full border border-hairline bg-surface text-xs font-semibold text-ink-2 hover:text-ink">
        {email.slice(0, 1).toUpperCase()}
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-label={pick(language, "关闭账户菜单", "Close account menu")} onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-64 rounded-2xl border border-hairline bg-surface p-2 shadow-2xl">
            <div className="truncate px-3 py-2 text-xs text-ink-muted">{email}</div>
            <button type="button" onClick={() => supabase.auth.signOut().then(() => window.location.assign("/"))} className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink-2 hover:bg-ink/[0.06] hover:text-ink">
              {pick(language, "退出登录", "Sign out")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Notifications() {
  const language = useLanguage();
  const [items, setItems] = useState<Decision[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const load = () => getDecisions().then(setItems).catch(() => {});
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  const pending = items.filter((decision) => decision.status === "proposed").length;

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label={pick(language, "活动通知", "Activity notifications")} aria-expanded={open} className="relative flex size-8 items-center justify-center rounded-full border border-hairline text-ink-2 hover:bg-ink/10 hover:text-ink">
        <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {pending > 0 && <span className="absolute right-0.5 top-0.5 size-2 animate-pulse rounded-full bg-accent" />}
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-label={pick(language, "关闭通知", "Close notifications")} onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-hairline bg-surface p-2 shadow-2xl animate-[toast-in_.15s_ease-out]">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">{pick(language, "最近活动", "Recent activity")}</span>
              {pending > 0 && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">{pick(language, `${pending} 笔待确认`, `${pending} awaiting approval`)}</span>}
            </div>
            {items.slice(0, 8).map((decision) => (
              <Link key={decision.id} href={decision.status === "proposed" ? "/chat" : "/activity"} onClick={() => setOpen(false)} className="flex items-start gap-2.5 rounded-lg px-3 py-2 hover:bg-ink/[0.06]">
                <span aria-hidden className={`mt-1.5 size-1.5 shrink-0 rounded-full ${decision.status === "proposed" ? "animate-pulse bg-accent" : decision.status === "blocked" ? "bg-critical" : decision.status === "rejected" ? "bg-baseline" : "bg-good"}`} />
                <span className="min-w-0">
                  <span className="block truncate text-sm">
                    {decision.symbol
                      ? pick(language, `${decision.action === "sell" ? "卖出" : "买入"} ${decision.qty} 股 ${decision.symbol}`, `${decision.action === "sell" ? "Sell" : "Buy"} ${decision.qty} ${decision.symbol}`)
                      : decision.action === "rebalance"
                        ? pick(language, "投资组合调整方案", "Portfolio plan")
                        : pick(language, "继续持有", "Hold")}
                  </span>
                  <span className="block text-[11px] text-ink-muted">{dateTime(decision.createdAt)}</span>
                </span>
              </Link>
            ))}
            {items.length === 0 && <p className="px-3 py-2 text-sm text-ink-muted">{pick(language, "还没有活动记录，可以从“研究助手”开始。", "Nothing yet — start a research run from Research.")}</p>}
            <Link href="/activity" onClick={() => setOpen(false)} className="mt-1 block rounded-lg px-3 py-2 text-xs font-semibold text-series-1 hover:bg-ink/[0.06]">
              {pick(language, "查看全部活动 →", "Open full activity →")}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export function TopBar() {
  const pathname = usePathname();
  const language = useLanguage();

  return (
    <header className="relative z-30 shrink-0 border-b border-hairline bg-page/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-5 px-4 sm:px-6 lg:px-8">
        <Wordmark />
        <nav className="hidden min-w-0 flex-1 items-center gap-1 lg:flex" aria-label={pick(language, "主导航", "Primary navigation")}>
          {PRIMARY_NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${active ? "bg-ink/[0.07] text-ink dark:bg-white/10" : "text-ink-2 hover:bg-ink/[0.05] hover:text-ink dark:hover:bg-white/5"}`}>
                {item[language]}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-hairline px-2.5 py-1 text-[11px] font-medium text-ink-muted xl:flex">
            <span aria-hidden className="size-1.5 rounded-full bg-warning" />
            {pick(language, "模拟投资", "Simulated")}
          </span>
          <LanguageToggle />
          <ThemeToggle />
          <Link href="/setup" aria-label={pick(language, "投资偏好", "Investor profile")} aria-current={pathname === "/setup" ? "page" : undefined} className={`hidden size-8 items-center justify-center rounded-full border border-hairline sm:flex ${pathname === "/setup" ? "bg-ink/10 text-ink" : "text-ink-2 hover:bg-ink/10 hover:text-ink"}`}>
            <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round"><path d="M4 21v-8M4 9V3M12 21v-5M12 12V3M20 21v-10M20 7V3M2 11h4M10 14h4M18 9h4" /></svg>
          </Link>
          <Link href="/settings" aria-label={pick(language, "设置与风控", "Settings and safeguards")} aria-current={pathname === "/settings" ? "page" : undefined} className={`hidden size-8 items-center justify-center rounded-full border border-hairline sm:flex ${pathname === "/settings" ? "bg-ink/10 text-ink" : "text-ink-2 hover:bg-ink/10 hover:text-ink"}`}>
            <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-5" /></svg>
          </Link>
          <Notifications />
          <AccountControl />
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-hairline px-3 py-2 lg:hidden" aria-label={pick(language, "主导航", "Primary navigation")}>
        {MOBILE_NAV.map((item) => {
          const active = pathname === item.href;
          return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${active ? "bg-ink/[0.07] font-medium text-ink dark:bg-white/10" : "text-ink-2"}`}>{item[language]}</Link>;
        })}
      </nav>
      <div className="border-t border-hairline px-4 py-1.5 text-center text-[10px] text-ink-muted sm:text-[11px]">
        <span aria-hidden className="mr-1.5 inline-block size-1.5 rounded-full bg-warning" />
        <strong className="font-semibold text-ink">{pick(language, "模拟交易", "Paper trading")}</strong>
        {pick(language, " · 不涉及真实资金，也不构成投资建议。", " · No real money. Not financial advice.")}
      </div>
    </header>
  );
}
