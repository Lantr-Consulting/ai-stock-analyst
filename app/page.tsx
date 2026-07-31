"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Allocation } from "@/components/allocation";
import { Card, StatTile, StatusBadge } from "@/components/ui";
import { ValueChart } from "@/components/value-chart";
import {
  getDecisions,
  getPortfolio,
  isSignedOut,
  type LivePortfolio,
} from "@/lib/api";
import { dateTime, usd } from "@/lib/format";
import {
  decisions as mockDecisions,
  portfolio as mockPortfolio,
  valueHistory as mockHistory,
  weeklySummary,
} from "@/lib/mock";
import type { Decision } from "@/lib/types";

export default function Dashboard() {
  const [live, setLive] = useState<LivePortfolio | null>(null);
  const [decisions, setDecisions] = useState<Decision[] | null>(null);
  const [status, setStatus] = useState<"live" | "signedOut" | "offline">("live");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getPortfolio(), getDecisions()])
      .then(([p, d]) => {
        setLive(p);
        setDecisions(d);
      })
      .catch((e) => setStatus(isSignedOut(e) ? "signedOut" : "offline"))
      .finally(() => setLoading(false));
  }, []);
  const offline = status !== "live";

  const snapshot = live ?? mockPortfolio;
  const history = live ? live.history : mockHistory;
  const recent = decisions ?? mockDecisions;

  const invested = snapshot.positions.reduce((s, p) => s + p.shares * p.price, 0);
  const cost = snapshot.positions.reduce((s, p) => s + p.shares * p.costBasis, 0);
  const total = live ? live.equity : invested + snapshot.cash;
  const gain = invested - cost;
  const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
  const start = history[0]?.value ?? total;
  const totalReturnPct = start > 0 ? ((total - start) / start) * 100 : 0;
  const pending = recent.filter((d) => d.status === "proposed");

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-ink/5 dark:bg-white/10" />
        <div className="h-72 animate-pulse rounded-xl bg-ink/5 dark:bg-white/10" />
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-ink/5 dark:bg-white/10" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Portfolio</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            {status === "signedOut" ? (
              <>
                Sample data —{" "}
                <Link href="/signin" className="font-medium text-series-1 hover:underline">
                  sign in
                </Link>{" "}
                to see your own agent
              </>
            ) : status === "offline" ? (
              "Sample data — backend unreachable"
            ) : (
              `Live paper account${live?.sharedDemoAccount ? " (shared demo)" : ""} · as of ${dateTime(snapshot.asOf)}`
            )}
          </p>
        </div>
        {pending.length > 0 && (
          <Link
            href="/proposals"
            className="btn-primary px-3.5 py-2 text-sm font-medium "
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
        {history.length >= 2 ? (
          <ValueChart points={history} />
        ) : (
          <p className="rounded-lg border border-dashed border-hairline px-4 py-8 text-center text-sm text-ink-muted">
            The value chart appears once the account has a couple of days of
            history. Fresh paper account — check back tomorrow.
          </p>
        )}
      </Card>

      <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
        <StatTile label="Cash" value={usd(snapshot.cash)} />
        <StatTile
          label="Unrealized gain"
          value={usd(gain)}
          delta={cost > 0 ? `${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(1)}% on invested` : undefined}
          deltaGood={gain >= 0}
        />
        <StatTile label="Positions" value={String(snapshot.positions.length)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Allocation">
          {snapshot.positions.length > 0 ? (
            <Allocation snapshot={snapshot} />
          ) : (
            <p className="text-sm text-ink-2">
              All cash so far — the agent hasn&apos;t bought anything yet.
              Approved trades appear here after they fill.
            </p>
          )}
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
          {recent.length === 0 ? (
            <p className="text-sm text-ink-2">
              No decisions yet — run a research cycle from the Proposals page.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {recent.slice(0, 4).map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {d.action === "hold" || !d.symbol
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
          )}
        </Card>
      </div>

      {offline && (
        <Card title={`Weekly summary — ${weeklySummary.period}`}>
          <p className="text-sm leading-relaxed text-ink-2">
            {weeklySummary.text}
          </p>
        </Card>
      )}
    </div>
  );
}
