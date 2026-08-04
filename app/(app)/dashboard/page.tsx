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
          <h1 className="text-xl font-semibold tracking-tight">投资组合</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            {status === "signedOut" ? (
              <>
                当前展示演示数据。{" "}
                <Link href="/signin" className="font-medium text-series-1 hover:underline">
                  登录
                </Link>{" "}
                后可查看你的研究助手
              </>
            ) : status === "offline" ? (
              "暂时无法连接服务，当前展示演示数据"
            ) : (
              `模拟账户${live?.sharedDemoAccount ? "（公开演示账户）" : ""} · 更新于 ${dateTime(snapshot.asOf)}`
            )}
          </p>
        </div>
        {pending.length > 0 && (
          <Link
            href="/proposals"
            className="btn-primary px-3.5 py-2 text-sm font-medium "
          >
            {pending.length} 笔交易待确认
          </Link>
        )}
      </header>

      <Card>
        <div className="mb-4">
          <div className="text-xs text-ink-muted">
            组合总资产（模拟）
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
              启用以来 {Math.abs(totalReturnPct).toFixed(1)}%
            </span>
          </div>
        </div>
        {history.length >= 2 ? (
          <ValueChart points={history} />
        ) : (
          <p className="rounded-lg border border-dashed border-hairline px-4 py-8 text-center text-sm text-ink-muted">
            账户积累至少两天记录后，这里会显示资产曲线。新的模拟账户明天再来看即可。
          </p>
        )}
      </Card>

      <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
        <StatTile label="现金" value={usd(snapshot.cash)} />
        <StatTile
          label="未实现盈亏"
          value={usd(gain)}
          delta={cost > 0 ? `已投入资金 ${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(1)}%` : undefined}
          deltaGood={gain >= 0}
        />
        <StatTile label="持仓数" value={String(snapshot.positions.length)} />
      </div>

      {snapshot.positions.length > 0 && (
        <Card title="持仓明细" className="!p-0 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 border-b border-hairline bg-surface-2 px-5 py-2 text-[11px] font-bold uppercase tracking-wide text-ink-muted max-sm:grid-cols-[1fr_auto_auto]">
            <span>标的</span>
            <span className="text-right">市值</span>
            <span className="text-right">累计盈亏</span>
            <span className="text-right max-sm:hidden">今日</span>
          </div>
          {snapshot.positions
            .slice()
            .sort((a, b) => b.shares * b.price - a.shares * a.price)
            .map((p) => {
              const value = p.shares * p.price;
              const pl = p.unrealizedPl ?? (p.price - p.costBasis) * p.shares;
              const plPct =
                p.unrealizedPlPct ?? (p.costBasis > 0 ? (p.price / p.costBasis - 1) * 100 : 0);
              return (
                <div
                  key={p.symbol}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 border-b border-hairline px-5 py-3 last:border-0 max-sm:grid-cols-[1fr_auto_auto]"
                >
                  <span>
                    <span className="text-sm font-bold tracking-tight">{p.symbol}</span>
                    <span className="ml-2 text-xs text-ink-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {p.shares} × {usd(p.price)}
                    </span>
                  </span>
                  <span className="text-right text-sm font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {usd(value)}
                  </span>
                  <span
                    className={`w-28 text-right text-sm font-semibold ${pl >= 0 ? "text-delta-up" : "text-delta-down"}`}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {pl >= 0 ? "+" : "−"}{usd(Math.abs(pl))}
                    <span className="ml-1 text-xs font-medium">
                      ({plPct >= 0 ? "+" : ""}{plPct.toFixed(1)}%)
                    </span>
                  </span>
                  <span
                    className={`w-16 text-right text-xs font-semibold max-sm:hidden ${
                      p.todayPct == null ? "text-ink-muted" : p.todayPct >= 0 ? "text-delta-up" : "text-delta-down"
                    }`}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {p.todayPct == null ? "—" : `${p.todayPct >= 0 ? "+" : ""}${p.todayPct.toFixed(1)}%`}
                  </span>
                </div>
              );
            })}
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="资产配置">
          {snapshot.positions.length > 0 ? (
            <Allocation snapshot={snapshot} />
          ) : (
            <p className="text-sm text-ink-2">
              当前全部为现金，研究助手还没有执行买入。你确认的模拟交易成交后会显示在这里。
            </p>
          )}
        </Card>

        <Card
          title="最近决策"
          action={
            <Link
              href="/activity"
              className="text-xs font-medium text-series-1 hover:underline"
            >
              查看全部记录
            </Link>
          }
        >
          {recent.length === 0 ? (
            <p className="text-sm text-ink-2">
              暂无决策。前往“研究助手”发起一次研究即可开始。
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {recent.slice(0, 4).map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {d.action === "hold" || !d.symbol
                        ? "继续持有，不操作"
                        : `${d.action === "buy" ? "买入" : "卖出"} ${d.qty} 股 ${d.symbol}`}
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
        <Card title={`本周小结 · ${weeklySummary.period}`}>
          <p className="text-sm leading-relaxed text-ink-2">
            {weeklySummary.text}
          </p>
        </Card>
      )}
    </div>
  );
}
