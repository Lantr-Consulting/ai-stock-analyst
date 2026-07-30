import Link from "next/link";
import { Allocation } from "@/components/allocation";
import { Card, StatTile, StatusBadge } from "@/components/ui";
import { ValueChart } from "@/components/value-chart";
import { dateTime, usd } from "@/lib/format";
import { decisions, portfolio, valueHistory, weeklySummary } from "@/lib/mock";

export default function Dashboard() {
  const invested = portfolio.positions.reduce(
    (s, p) => s + p.shares * p.price,
    0
  );
  const cost = portfolio.positions.reduce(
    (s, p) => s + p.shares * p.costBasis,
    0
  );
  const total = invested + portfolio.cash;
  const gain = invested - cost;
  const gainPct = (gain / cost) * 100;
  const start = valueHistory[0].value;
  const totalReturnPct = ((total - start) / start) * 100;
  const pending = decisions.filter((d) => d.status === "proposed");

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Portfolio</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            Paper account · as of {dateTime(portfolio.asOf)}
          </p>
        </div>
        {pending.length > 0 && (
          <Link
            href="/proposals"
            className="rounded-lg bg-series-1 px-3.5 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {pending.length} trade{pending.length > 1 ? "s" : ""} awaiting
            approval
          </Link>
        )}
      </header>

      <Card>
        <div className="mb-4">
          <div className="text-xs text-ink-muted">
            Total portfolio value (simulated)
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
            <span
              className="text-4xl font-semibold tracking-tight"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {usd(total)}
            </span>
            <span
              className={`text-sm font-medium ${
                totalReturnPct >= 0 ? "text-delta-up" : "text-delta-down"
              }`}
            >
              {totalReturnPct >= 0 ? "↑" : "↓"}{" "}
              {Math.abs(totalReturnPct).toFixed(1)}% since start
            </span>
          </div>
        </div>
        <ValueChart points={valueHistory} />
      </Card>

      <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
        <StatTile label="Cash" value={usd(portfolio.cash)} />
        <StatTile
          label="Unrealized gain"
          value={usd(gain)}
          delta={`${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(1)}% on invested`}
          deltaGood={gain >= 0}
        />
        <StatTile
          label="Positions"
          value={String(portfolio.positions.length)}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Allocation">
          <Allocation snapshot={portfolio} />
        </Card>

        <Card
          title="Recent decisions"
          action={
            <Link
              href="/activity"
              className="text-xs font-medium text-series-1 hover:underline"
            >
              View all activity
            </Link>
          }
        >
          <ul className="flex flex-col gap-3">
            {decisions.slice(0, 4).map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {d.action === "hold"
                      ? "Hold — no action"
                      : `${d.action === "buy" ? "Buy" : "Sell"} ${d.qty} ${d.symbol}`}
                    {d.estValue ? (
                      <span className="text-ink-muted"> · ~{usd(d.estValue)}</span>
                    ) : null}
                  </div>
                  <div className="text-xs text-ink-muted">
                    {dateTime(d.createdAt)}
                  </div>
                </div>
                <StatusBadge status={d.status} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title={`Weekly summary — ${weeklySummary.period}`}>
        <p className="text-sm leading-relaxed text-ink-2">{weeklySummary.text}</p>
      </Card>

      <table className="sr-only">
        <caption>Portfolio value history</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {valueHistory.map((p) => (
            <tr key={p.date}>
              <td>{p.date}</td>
              <td>{usd(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
