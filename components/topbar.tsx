"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDecisions } from "@/lib/api";
import { dateTime } from "@/lib/format";
import type { Decision } from "@/lib/types";

export function TopBar() {
  const [items, setItems] = useState<Decision[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const load = () => getDecisions().then(setItems).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const pending = items.filter((d) => d.status === "proposed").length;

  return (
    <div className="relative flex items-center gap-2 border-b border-hairline bg-page px-5 py-1.5">
      <span aria-hidden className="inline-block size-2 rounded-full bg-warning" />
      <span className="text-[11px] text-ink-muted">
        <strong className="font-semibold text-ink">Simulated</strong> — paper
        trading. No real money, not financial advice.
      </span>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Activity notifications"
        className="relative ml-auto rounded-full p-1.5 text-ink-2 hover:bg-white/10 hover:text-ink"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {pending > 0 && (
          <span className="absolute right-0.5 top-0.5 size-2 animate-pulse rounded-full bg-accent" />
        )}
      </button>
      {open && (
        <>
          <button
            aria-label="Close notifications"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-3 top-9 z-50 w-80 rounded-2xl border border-hairline bg-surface p-2 shadow-2xl animate-[toast-in_.15s_ease-out]">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                Recent activity
              </span>
              {pending > 0 && (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                  {pending} awaiting approval
                </span>
              )}
            </div>
            {items.slice(0, 8).map((d) => (
              <Link
                key={d.id}
                href={d.status === "proposed" ? "/chat" : "/activity"}
                onClick={() => setOpen(false)}
                className="flex items-start gap-2.5 rounded-lg px-3 py-2 hover:bg-white/5"
              >
                <span
                  aria-hidden
                  className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                    d.status === "proposed"
                      ? "animate-pulse bg-accent"
                      : d.status === "blocked"
                        ? "bg-critical"
                        : d.status === "rejected"
                          ? "bg-baseline"
                          : "bg-good"
                  }`}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm">
                    {d.symbol
                      ? `${d.action === "sell" ? "Sell" : "Buy"} ${d.qty} ${d.symbol}`
                      : d.action === "rebalance"
                        ? "Portfolio plan"
                        : "Hold"}
                    <span className="ml-1.5 text-xs text-ink-muted">{d.status}</span>
                  </span>
                  <span className="block text-[11px] text-ink-muted">
                    {dateTime(d.createdAt)}
                  </span>
                </span>
              </Link>
            ))}
            {items.length === 0 && (
              <p className="px-3 py-2 text-sm text-ink-muted">
                Nothing yet — run research from the Analyst tab.
              </p>
            )}
            <Link
              href="/activity"
              onClick={() => setOpen(false)}
              className="mt-1 block rounded-lg px-3 py-2 text-xs font-semibold text-series-1 hover:bg-white/5"
            >
              Open full activity →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
