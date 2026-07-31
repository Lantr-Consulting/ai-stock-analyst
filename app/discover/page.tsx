"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getMarketOverview,
  getTicker,
  getMe,
  updateSettings,
  type Mover,
  type TickerDetail,
} from "@/lib/api";
import { Card } from "@/components/ui";
import { dateTime, usd } from "@/lib/format";
import { useToast } from "@/components/toast";

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
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const toast = useToast();

  useEffect(() => {
    getMarketOverview().then(setOverview).catch(() => {});
    getMe()
      .then((me) => {
        setCanWatch(true);
        setWatchlist(me.strategy.universe ?? []);
      })
      .catch(() => {});
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
      setErr(e instanceof Error ? e.message : "Lookup failed.");
    }
    setLoading(false);
  }

  async function addToWatchlist(sym: string) {
    try {
      const next = [...new Set([...watchlist, sym])];
      await updateSettings({ universe: next });
      setWatchlist(next);
      toast("success", `${sym} added to your watchlist.`);
    } catch {
      toast("error", "Couldn't update the watchlist — are you signed in and activated?");
    }
  }

  const ind = detail?.indicators;
  const trendUp =
    ind?.sma20 != null && ind?.price != null ? ind.price >= ind.sma20 : null;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Discover</h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          Live market movers and any US-listed ticker — prices, trend,
          momentum, and news from Alpaca. Hand anything interesting to your
          analyst.
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
          placeholder="Look up any ticker — TSLA, SPCX, MRVL…"
          className="flex-1 rounded-full border border-hairline bg-surface px-5 py-2.5 text-sm outline-none placeholder:text-ink-muted focus:border-accent"
        />
        <button type="submit" disabled={loading} className="btn-primary px-5 py-2.5 text-sm">
          {loading ? "Looking…" : "Look up"}
        </button>
      </form>
      {err && <p className="text-sm text-critical">{err}</p>}

      {detail && (
        <Card className="!p-0 overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline bg-surface-2 px-5 py-4">
            <div>
              <h2 className="text-lg font-bold tracking-tight">
                {detail.info.symbol}
                <span className="ml-2 text-sm font-normal text-ink-2">
                  {detail.info.name}
                </span>
              </h2>
              <p className="mt-0.5 text-[11px] text-ink-muted">
                {detail.info.exchange}
                {detail.info.tradable ? " · tradable" : " · not tradable"}
              </p>
            </div>
            {ind?.price != null && (
              <div className="text-right">
                <div className="text-3xl font-bold tracking-tight" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {usd(ind.price)}
                </div>
                {ind.return30dPct != null && (
                  <div
                    className={`text-xs font-medium ${ind.return30dPct >= 0 ? "text-delta-up" : "text-delta-down"}`}
                  >
                    {ind.return30dPct >= 0 ? "+" : ""}
                    {ind.return30dPct}% 30d
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="px-5 py-4">
            <Spark closes={detail.bars.map((b) => b.close)} className="h-32 w-full" fill id={detail.info.symbol} />
            {ind && !ind.error && (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Trend" value={trendUp == null ? "—" : trendUp ? "Above SMA20" : "Below SMA20"} tone={trendUp == null ? "" : trendUp ? "text-delta-up" : "text-delta-down"} />
                <Stat label="RSI 14" value={ind.rsi14 != null ? String(ind.rsi14) : "—"} tone={ind.rsi14 != null && ind.rsi14 < 35 ? "text-delta-up" : ind.rsi14 != null && ind.rsi14 > 70 ? "text-delta-down" : ""} />
                <Stat label="Volatility" value={ind.annualizedVolPct != null ? `${ind.annualizedVolPct}%` : "—"} />
                <Stat label="Max drawdown 60d" value={ind.maxDrawdown60dPct != null ? `${ind.maxDrawdown60dPct}%` : "—"} />
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/chat" className="btn-primary px-4 py-2 text-sm">
                Ask the analyst about {detail.info.symbol}
              </Link>
              {canWatch && !watchlist.includes(detail.info.symbol) && (
                <button onClick={() => addToWatchlist(detail.info.symbol)} className="btn-ghost px-4 py-2 text-sm">
                  + Add to watchlist
                </button>
              )}
              {watchlist.includes(detail.info.symbol) && (
                <span className="inline-flex items-center rounded-full bg-series-1/15 px-3 py-1.5 text-xs font-medium text-series-1">
                  On your watchlist
                </span>
              )}
            </div>
            {detail.news.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  Recent news
                </div>
                <ul className="flex flex-col gap-2">
                  {detail.news.map((n, i) => (
                    <li key={i} className="rounded-lg bg-page px-3 py-2">
                      <div className="text-sm font-medium">{n.headline}</div>
                      <div className="mt-0.5 text-[11px] text-ink-muted">
                        {n.source} · {dateTime(n.at)}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          { title: "Top gainers", rows: overview?.gainers ?? [] },
          { title: "Top losers", rows: overview?.losers ?? [] },
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
        <Card title="Most active" className="!px-2 !py-4 [&>div]:px-3">
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
                {(m.volume / 1e6).toFixed(1)}M
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
