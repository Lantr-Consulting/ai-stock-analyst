"use client";

import type { ReactNode } from "react";
import type { DecisionStatus, SafeguardCheck } from "@/lib/types";
import { pick, useLanguage } from "@/lib/language";

export function SimulatedBanner() {
  const language = useLanguage();
  return (
    <div className="flex items-center gap-2 border-b border-hairline bg-page px-5 py-1.5 text-[11px] text-ink-muted">
      <span aria-hidden className="inline-block size-2 rounded-full bg-warning" />
      <span>
        <strong className="font-semibold text-ink">{pick(language, "模拟交易", "Paper trading")}</strong>{" "}
        — {pick(language, "当前账户只使用模拟资金，不涉及真实投资，也不构成投资建议。", "This account uses simulated funds only. No real money is involved, and nothing here is investment advice.")}
      </span>
    </div>
  );
}

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl bg-surface p-5 ${className}`}
    >
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && (
            <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatTile({
  label,
  value,
  delta,
  deltaGood,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaGood?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-surface p-4">
      <div className="text-xs text-ink-muted">{label}</div>
      <div
        className="mt-1 text-2xl font-semibold tracking-tight"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </div>
      {delta && (
        <div
          className={`mt-0.5 text-xs font-medium ${
            deltaGood ? "text-delta-up" : "text-delta-down"
          }`}
        >
          {delta}
        </div>
      )}
    </div>
  );
}

const STATUS_STYLES: Record<DecisionStatus, { zh: string; en: string; cls: string }> = {
  proposed: { zh: "等待确认", en: "Awaiting review", cls: "bg-accent/15 text-accent" },
  approved: { zh: "已同意", en: "Approved", cls: "bg-good/10 text-delta-up dark:text-good" },
  filled: { zh: "已成交", en: "Filled", cls: "bg-good/10 text-delta-up dark:text-good" },
  rejected: { zh: "已拒绝", en: "Rejected", cls: "bg-white/10 text-ink-2" },
  blocked: { zh: "未通过风控", en: "Blocked", cls: "bg-critical/10 text-critical" },
};

export function StatusBadge({ status }: { status: DecisionStatus }) {
  const language = useLanguage();
  const s = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}
    >
      {s[language]}
    </span>
  );
}

export function SafeguardList({ checks }: { checks: SafeguardCheck[] }) {
  const language = useLanguage();
  if (checks.length === 0) return null;
  return (
    <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
      {checks.map((c) => (
        <li key={c.name} className="flex items-start gap-2 text-sm">
          <span
            aria-hidden
            className={`mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
              c.status === "pass" ? "bg-good" : "bg-critical"
            }`}
          >
            {c.status === "pass" ? "✓" : "✕"}
          </span>
          <span>
            <span className="font-medium">{c.name}</span>
            <span className="text-ink-2"> — {c.detail}</span>
            <span className="sr-only">
              {c.status === "pass" ? pick(language, "（通过）", "(passed)") : pick(language, "（未通过）", "(failed)")}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
