import type { ReactNode } from "react";
import type { DecisionStatus, SafeguardCheck } from "@/lib/types";

export function SimulatedBanner() {
  return (
    <div className="flex items-center gap-2 border-b border-hairline bg-surface px-5 py-2 text-xs text-ink-2">
      <span aria-hidden className="inline-block size-2 rounded-full bg-warning" />
      <span>
        <strong className="font-semibold text-ink">Simulated</strong> — this is a
        paper-trading account. No real money is invested, and nothing here is
        financial advice.
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
      className={`rounded-xl border border-hairline bg-surface p-5 ${className}`}
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
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
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

const STATUS_STYLES: Record<DecisionStatus, { label: string; cls: string }> = {
  proposed: { label: "Awaiting approval", cls: "bg-series-1/10 text-series-1" },
  approved: { label: "Approved", cls: "bg-good/10 text-delta-up dark:text-good" },
  filled: { label: "Filled", cls: "bg-good/10 text-delta-up dark:text-good" },
  rejected: { label: "Rejected", cls: "bg-ink/5 text-ink-2 dark:bg-white/10" },
  blocked: { label: "Blocked by safeguard", cls: "bg-critical/10 text-critical" },
};

export function StatusBadge({ status }: { status: DecisionStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

export function SafeguardList({ checks }: { checks: SafeguardCheck[] }) {
  if (checks.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5">
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
              {c.status === "pass" ? " (passed)" : " (failed)"}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
