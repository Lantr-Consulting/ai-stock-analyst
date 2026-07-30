import type { PortfolioSnapshot } from "@/lib/types";
import { usd } from "@/lib/format";

const SERIES = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
];

export function Allocation({ snapshot }: { snapshot: PortfolioSnapshot }) {
  const rows = snapshot.positions.map((p) => ({
    label: p.symbol,
    name: p.name,
    value: p.shares * p.price,
  }));
  rows.push({ label: "Cash", name: "Available cash", value: snapshot.cash });
  const total = rows.reduce((s, r) => s + r.value, 0);

  return (
    <div>
      <div
        className="flex h-4 w-full overflow-hidden rounded-full"
        style={{ gap: 2 }}
        role="img"
        aria-label="Portfolio allocation"
      >
        {rows.map((r, i) => (
          <div
            key={r.label}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${(r.value / total) * 100}%`,
              background:
                r.label === "Cash" ? "var(--baseline)" : SERIES[i % SERIES.length],
            }}
          />
        ))}
      </div>
      <ul className="mt-4 flex flex-col gap-2">
        {rows.map((r, i) => (
          <li key={r.label} className="flex items-center gap-2.5 text-sm">
            <span
              aria-hidden
              className="inline-block size-2.5 shrink-0 rounded-[3px]"
              style={{
                background:
                  r.label === "Cash"
                    ? "var(--baseline)"
                    : SERIES[i % SERIES.length],
              }}
            />
            <span className="w-14 font-medium">{r.label}</span>
            <span className="flex-1 truncate text-ink-2">{r.name}</span>
            <span
              className="text-ink-2"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {((r.value / total) * 100).toFixed(1)}%
            </span>
            <span
              className="w-24 text-right font-medium"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {usd(r.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
