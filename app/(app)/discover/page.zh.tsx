"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getMarketOverview,
  getPortfolio,
  getSparklines,
  getTicker,
  getMe,
  updateSettings,
  type Mover,
  type TickerDetail,
} from "@/lib/api";
import { Card } from "@/components/ui";
import { dateTime, usd } from "@/lib/format";
import { useToast } from "@/components/toast";
import type { Position } from "@/lib/types";

function Spark({
  closes,
  className = "h-16 w-full",
  fill = false,
  id = "",
}: {
  closes: number[];
  className?: string;
  fill?: boolean;
  id?: string;
}) {
  if (closes.length < 2) return null;
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const up = closes[closes.length - 1] >= closes[0];
  const color = up ? "var(--series-1)" : "var(--critical)";
  const pt = (c: number, i: number) =>
    `${(i / (closes.length - 1)) * 300},${60 - ((c - min) / (max - min || 1)) * 54 + 3}`;
  const pts = closes.map(pt).join(" ");
  return (
    <svg viewBox="0 0 300 64" className={className} preserveAspectRatio="none" aria-hidden>
      {fill && (
        <>
          <defs>
            <linearGradient id={`sg-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <polygon points={`${pts} 300,64 0,64`} fill={`url(#sg-${id})`} />
        </>
      )}
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function MoverRow({
  m,
  spark,
  onPick,
}: {
  m: Mover;
  spark?: number[];
  onPick: (s: string) => void;
}) {
  const up = m.pctChange >= 0;
  return (
    <button
      onClick={() => onPick(m.symbol)}
      className="grid w-full grid-cols-[3.5rem_1fr_auto] items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/5"
    >
      <span className="text-sm font-bold tracking-tight">{m.symbol}</span>
      <span className="h-7">
        {spark && spark.length > 1 && <Spark closes={spark} className="h-7 w-full" />}
      </span>
      <span className="flex flex-col items-end">
        <span className="text-sm font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
          {usd(m.price)}
        </span>
        <span
          className={`text-xs font-semibold ${up ? "text-delta-up" : "text-delta-down"}`}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {up ? "+" : ""}
          {m.pctChange.toFixed(2)}%
        </span>
      </span>
    </button>
  );
}

export default function DiscoverPage() {
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof getMarketOverview>> | null>(null);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<TickerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [canWatch, setCanWatch] = useState(false);
  const [tf, setTf] = useState<"1W" | "1M" | "3M">("1M");
  const [buyQty, setBuyQty] = useState(10);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const toast = useToast();

  const [mine, setMine] = useState<{
    positions: Position[];
    sparks: Record<string, number[]>;
  }>({ positions: [], sparks: {} });

  useEffect(() => {
    getMarketOverview().then(setOverview).catch(() => {});
    (async () => {
      try {
        const me = await getMe();
        setCanWatch(true);
        const wl = me.strategy.universe ?? [];
        setWatchlist(wl);
        let positions: Position[] = [];
        try {
          const p = await getPortfolio();
          positions = p.positions;
        } catch {}
        const syms = [...new Set([...positions.map((p) => p.symbol), ...wl])];
        if (syms.length) {
          const { sparks } = await getSparklines(syms);
          setMine({ positions, sparks });
        } else {
          setMine({ positions, sparks: {} });
        }
      } catch {}
    })();
  }, []);

  async function lookup(sym: string) {
    const s = sym.trim().toUpperCase();
    if (!s || loading) return;
    setLoading(true);
    setErr(null);
    try {
      setDetail(await getTicker(s));
    } catch (e) {
      setDetail(null);
      setErr(e instanceof Error && e.message.includes("not found") ? "没有找到这个美股代码。" : "暂时无法查询，请稍后再试。 ");
    }
    setLoading(false);
  }

  async function addToWatchlist(sym: string) {
    try {
      const next = [...new Set([...watchlist, sym])];
      await updateSettings({ universe: next });
      setWatchlist(next);
      toast("success", `${sym} 已加入研究范围。`);
    } catch {
      toast("error", "暂时无法更新研究范围，请确认已登录并启用研究助手。 ");
    }
  }

  const ind = detail?.indicators;
  const trendUp =
    ind?.sma20 != null && ind?.price != null ? ind.price >= ind.sma20 : null;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">美股行情</h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          查看 Alpaca 提供的美股实时异动、价格、趋势、动量和新闻；发现感兴趣的标的后，可直接交给研究助手深入分析。
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          lookup(query);
        }}
        className="flex gap-2"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="输入美股代码，例如 TSLA、SPCX、MRVL…"
          className="flex-1 rounded-full border border-hairline bg-surface px-5 py-2.5 text-sm outline-none placeholder:text-ink-muted focus:border-accent"
        />
        <button type="submit" disabled={loading} className="btn-primary px-5 py-2.5 text-sm">
          {loading ? "正在查询…" : "查询"}
        </button>
      </form>
      {err && <p className="text-sm text-critical">{err}</p>}

      {detail && (() => {
        const closes = detail.bars.map((b) => b.close);
        const tfCloses =
          tf === "1W" ? closes.slice(-5) : tf === "1M" ? closes.slice(-21) : closes;
        const sym = detail.info.symbol;
        const est = (ind?.price ?? 0) * buyQty;
        const held = mine.positions.find((p) => p.symbol === sym);
        const heldPl = held ? held.unrealizedPl ?? (held.price - held.costBasis) * held.shares : 0;
        const heldPlPct = held ? held.unrealizedPlPct ?? (held.costBasis > 0 ? (held.price / held.costBasis - 1) * 100 : 0) : 0;
        const prevClose = closes.length >= 2 ? closes[closes.length - 2] : null;
        const dayCh = ind?.price != null && prevClose ? ind.price - prevClose : null;
        const dayPct = dayCh != null && prevClose ? (dayCh / prevClose) * 100 : null;
        const lo = closes.length ? Math.min(...closes) : null;
        const hi = closes.length ? Math.max(...closes) : null;
        const vols = detail.bars.map((b) => b.volume).filter((v): v is number => v != null);
        const avgVol = vols.length ? vols.reduce((a, b) => a + b, 0) / vols.length : null;
        return (
          <section className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <div className="min-w-0">
              <h2 className="flex flex-wrap items-center gap-2.5 text-2xl font-semibold tracking-tight">
                {detail.info.name}
                {held && (
                  <span className="rounded-full bg-series-1/15 px-2.5 py-1 text-xs font-semibold text-series-1">
                    已持有 {held.shares} 股
                  </span>
                )}
              </h2>
              {ind?.price != null && (
                <>
                  <div
                    className="mt-1 text-5xl font-bold tracking-tight"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {usd(ind.price)}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 text-sm font-semibold">
                    {dayCh != null && dayPct != null && Math.abs(dayPct) < 60 && (
                      <span className={dayCh >= 0 ? "text-delta-up" : "text-delta-down"}>
                        今日 {dayCh >= 0 ? "+" : "−"}{usd(Math.abs(dayCh))}（{dayPct >= 0 ? "+" : ""}{dayPct.toFixed(2)}%）
                      </span>
                    )}
                    {ind.return30dPct != null && (
                      <span className={ind.return30dPct >= 0 ? "text-delta-up" : "text-delta-down"}>
                        近 30 日 {ind.return30dPct >= 0 ? "+" : ""}{ind.return30dPct}%
                      </span>
                    )}
                  </div>
                </>
              )}
              <div className="mt-6">
                <Spark closes={tfCloses} className="h-64 w-full" fill id={sym} />
              </div>
              <div className="mt-3 flex items-center gap-5 border-b border-hairline pb-2 text-xs font-bold">
                {(["1W", "1M", "3M"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTf(t)}
                    className={`pb-1 ${
                      tf === t
                        ? "border-b-2 border-series-1 text-series-1"
                        : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {{ "1W": "1 周", "1M": "1 个月", "3M": "3 个月" }[t]}
                  </button>
                ))}
                <span className="ml-auto text-[11px] font-normal text-ink-muted">
                  {sym} · {detail.info.exchange}
                  {detail.info.tradable ? "" : " · 当前不可交易"}
                </span>
              </div>

              {detail.news.length > 0 && (
                <div className="mt-6">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                    最新资讯 · 英文原文
                  </div>
                  <ul>
                    {detail.news.map((n, i) => (
                      <li
                        key={i}
                        className="border-b border-hairline py-3 last:border-0"
                      >
                        <div className="text-sm font-medium leading-snug">
                          {n.headline}
                        </div>
                        <div className="mt-1 text-[11px] text-ink-muted">
                          {n.source} · {dateTime(n.at)}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <aside className="flex flex-col gap-4 lg:sticky lg:top-0 lg:self-start">
              {held && (
                <div className="rounded-2xl bg-surface p-5">
                  <h3 className="text-base font-bold tracking-tight">我的持仓</h3>
                  <div className="mt-4 flex flex-col gap-2.5 text-sm">
                    <div className="flex justify-between"><span className="text-ink-2">持有股数</span><span className="font-semibold" style={{fontVariantNumeric:"tabular-nums"}}>{held.shares}</span></div>
                    <div className="flex justify-between"><span className="text-ink-2">平均成本</span><span className="font-semibold" style={{fontVariantNumeric:"tabular-nums"}}>{usd(held.costBasis)}</span></div>
                    <div className="flex justify-between"><span className="text-ink-2">当前市值</span><span className="font-semibold" style={{fontVariantNumeric:"tabular-nums"}}>{usd(held.shares * held.price)}</span></div>
                    <div className="flex justify-between border-t border-hairline pt-2.5">
                      <span className="font-bold">累计盈亏</span>
                      <span className={`font-bold ${heldPl >= 0 ? "text-delta-up" : "text-delta-down"}`} style={{fontVariantNumeric:"tabular-nums"}}>
                        {heldPl >= 0 ? "+" : "−"}{usd(Math.abs(heldPl))} ({heldPlPct >= 0 ? "+" : ""}{heldPlPct.toFixed(1)}%)
                      </span>
                    </div>
                    {held.todayPct != null && (
                      <div className="flex justify-between">
                        <span className="text-ink-2">今日</span>
                        <span className={`font-semibold ${held.todayPct >= 0 ? "text-delta-up" : "text-delta-down"}`} style={{fontVariantNumeric:"tabular-nums"}}>
                          {held.todayPct >= 0 ? "+" : ""}{held.todayPct.toFixed(2)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="rounded-2xl bg-surface p-5">
                <h3 className="text-base font-bold tracking-tight">研究 {sym}</h3>
                <div className="mt-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">参考股数</span>
                    <input
                      type="number"
                      min={1}
                      value={buyQty}
                      onChange={(e) =>
                        setBuyQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))
                      }
                      className="w-24 rounded-lg border border-hairline bg-page px-3 py-1.5 text-right text-sm outline-none focus:border-accent"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-series-1">参考市价</span>
                    <span className="font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {ind?.price != null ? usd(ind.price) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-hairline pt-3">
                    <span className="text-sm font-bold">预计金额</span>
                    <span className="text-sm font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {usd(est)}
                    </span>
                  </div>
                  <Link
                    href={`/chat?ask=${encodeURIComponent(
                      held
                        ? `深入研究 ${sym} 的实时走势、技术指标和近期新闻。我目前以 ${usd(held.costBasis)} 的平均成本持有 ${held.shares} 股，累计盈亏为 ${heldPlPct >= 0 ? "+" : ""}${heldPlPct.toFixed(1)}%。请判断应当加仓、持有还是减仓；只有确有必要调整时，才运行研究并提出订单建议。`
                        : `深入研究 ${sym} 的实时走势、技术指标和近期新闻，并判断它是否符合我的策略与当前组合。只有确实值得建仓时，才运行研究并提出合适数量的订单建议。供参考，我正在考虑约 ${buyQty} 股，即 ${usd(est)}。`
                    )}`}
                    className="btn-primary w-full px-4 py-3 text-sm"
                  >
                    交给研究助手分析
                  </Link>
                  {canWatch && !watchlist.includes(sym) && (
                    <button onClick={() => addToWatchlist(sym)} className="btn-ghost w-full px-4 py-2.5 text-sm">
                      + 加入研究范围
                    </button>
                  )}
                  {watchlist.includes(sym) && (
                    <span className="inline-flex items-center justify-center rounded-full bg-series-1/15 px-3 py-2 text-xs font-medium text-series-1">
                      已在研究范围内
                    </span>
                  )}
                  <p className="text-[11px] leading-relaxed text-ink-muted">
                    助手会先完成研究并检查风控，再把模拟订单交给你确认。
                  </p>
                </div>
              </div>

              {ind && !ind.error && (
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="趋势" value={trendUp == null ? "—" : trendUp ? "高于 20 日均线" : "低于 20 日均线"} tone={trendUp == null ? "" : trendUp ? "text-delta-up" : "text-delta-down"} />
                  <Stat label="RSI（14 日）" value={ind.rsi14 != null ? String(ind.rsi14) : "—"} tone={ind.rsi14 != null && ind.rsi14 < 35 ? "text-delta-up" : ind.rsi14 != null && ind.rsi14 > 70 ? "text-delta-down" : ""} />
                  <Stat label="年化波动率" value={ind.annualizedVolPct != null ? `${ind.annualizedVolPct}%` : "—"} />
                  <Stat label="60 日最大回撤" value={ind.maxDrawdown60dPct != null ? `${ind.maxDrawdown60dPct}%` : "—"} />
                  <Stat label="前收盘价" value={prevClose != null ? usd(prevClose) : "—"} />
                  <Stat label="30 日平均成交量" value={avgVol != null ? `${(avgVol / 1e4).toFixed(1)} 万` : "—"} />
                  {lo != null && hi != null && (
                    <div className="col-span-2 rounded-xl bg-page px-3.5 py-3">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">60 日价格区间</div>
                      <div className="mt-1.5 flex items-center gap-2 text-xs font-semibold" style={{fontVariantNumeric:"tabular-nums"}}>
                        {usd(lo)}
                        <span className="relative h-1 flex-1 rounded-full bg-baseline">
                          {ind.price != null && hi > lo && (
                            <span
                              className="absolute -top-0.5 size-2 rounded-full bg-series-1"
                              style={{ left: `${Math.min(100, Math.max(0, ((ind.price - lo) / (hi - lo)) * 100))}%` }}
                            />
                          )}
                        </span>
                        {usd(hi)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </aside>
          </section>
        );
      })()}

      {(mine.positions.length > 0 || watchlist.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {mine.positions.length > 0 && (
            <Card title="我的持仓" className="!px-2 !py-4 [&>div]:px-3">
              {mine.positions.map((p) => (
                <button
                  key={p.symbol}
                  onClick={() => lookup(p.symbol)}
                  className="grid w-full grid-cols-[3.5rem_1fr_auto] items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/5"
                >
                  <span className="text-sm font-bold tracking-tight">{p.symbol}</span>
                  <span className="h-7">
                    {mine.sparks[p.symbol] && (
                      <Spark closes={mine.sparks[p.symbol]} className="h-7 w-full" />
                    )}
                  </span>
                  <span className="flex flex-col items-end">
                    <span className="text-sm font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {usd(p.price)}
                    </span>
                    {p.unrealizedPlPct != null && (
                      <span
                        className={`text-xs font-semibold ${p.unrealizedPlPct >= 0 ? "text-delta-up" : "text-delta-down"}`}
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {p.unrealizedPlPct >= 0 ? "+" : ""}
                        {p.unrealizedPlPct.toFixed(2)}%
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </Card>
          )}
          {watchlist.length > 0 && (
            <Card title="研究范围" className="!px-2 !py-4 [&>div]:px-3">
              {watchlist.map((sym) => {
                const closes = mine.sparks[sym];
                const last = closes?.[closes.length - 1];
                const pct =
                  closes && closes.length > 1 ? (last! / closes[0] - 1) * 100 : null;
                return (
                  <button
                    key={sym}
                    onClick={() => lookup(sym)}
                    className="grid w-full grid-cols-[3.5rem_1fr_auto] items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/5"
                  >
                    <span className="text-sm font-bold tracking-tight">{sym}</span>
                    <span className="h-7">
                      {closes && <Spark closes={closes} className="h-7 w-full" />}
                    </span>
                    <span className="flex flex-col items-end">
                      <span className="text-sm font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {last != null ? usd(last) : "—"}
                      </span>
                      {pct != null && (
                        <span
                          className={`text-xs font-semibold ${pct >= 0 ? "text-delta-up" : "text-delta-down"}`}
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {pct >= 0 ? "+" : ""}
                          近 30 日 {pct.toFixed(2)}%
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </Card>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          { title: "涨幅榜", rows: overview?.gainers ?? [] },
          { title: "跌幅榜", rows: overview?.losers ?? [] },
        ].map((col) => (
          <Card key={col.title} title={col.title} className="!px-2 !py-4 [&>div]:px-3">
            {col.rows.slice(0, 8).map((m) => (
              <MoverRow
                key={m.symbol}
                m={m}
                spark={overview?.sparks?.[m.symbol]}
                onPick={lookup}
              />
            ))}
            {!overview &&
              [0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="mx-3 my-2 h-9 animate-pulse rounded-lg bg-white/5" />
              ))}
          </Card>
        ))}
        <Card title="成交最活跃" className="!px-2 !py-4 [&>div]:px-3">
          {(overview?.mostActive ?? []).slice(0, 8).map((m) => (
            <button
              key={m.symbol}
              onClick={() => lookup(m.symbol)}
              className="grid w-full grid-cols-[3.5rem_1fr_auto] items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/5"
            >
              <span className="text-sm font-bold tracking-tight">{m.symbol}</span>
              <span className="h-7">
                {overview?.sparks?.[m.symbol] && (
                  <Spark closes={overview.sparks[m.symbol]} className="h-7 w-full" />
                )}
              </span>
              <span className="text-xs font-medium text-ink-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                {(m.volume / 1e4).toFixed(1)} 万
              </span>
            </button>
          ))}
          {!overview &&
            [0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="mx-3 my-2 h-9 animate-pulse rounded-lg bg-white/5" />
            ))}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-page px-3.5 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

