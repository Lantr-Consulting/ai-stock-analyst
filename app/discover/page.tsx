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

function Spark({ closes }: { closes: number[] }) {
  if (closes.length < 2) return null;
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const up = closes[closes.length - 1] >= closes[0];
  const pts = closes
    .map(
      (c, i) =>
        `${(i / (closes.length - 1)) * 300},${60 - ((c - min) / (max - min || 1)) * 56 + 2}`
    )
    .join(" ");
  return (
    <svg viewBox="0 0 300 64" className="h-16 w-full" aria-label="60-day price trend">
      <polyline
        points={pts}
        fill="none"
        stroke={up ? "var(--series-1)" : "var(--critical)"}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoverRow({ m, onPick }: { m: Mover; onPick: (s: string) => void }) {
  return (
    <button
      onClick={() => onPick(m.symbol)}
      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-white/5"
    >
      <span className="font-semibold">{m.symbol}</span>
      <span className="flex items-center gap-3">
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{usd(m.price)}</span>
        <span
          className={`w-16 text-right font-medium ${m.pctChange >= 0 ? "text-delta-up" : "text-delta-down"}`}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {m.pctChange >= 0 ? "+" : ""}
          {m.pctChange.toFixed(1)}%
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
                <div className="text-2xl font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
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
            <Spark closes={detail.bars.map((b) => b.close)} />
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
        <Card title="Top gainers">
          {(overview?.gainers ?? []).slice(0, 8).map((m) => (
            <MoverRow key={m.symbol} m={m} onPick={lookup} />
          ))}
          {!overview && <p className="text-sm text-ink-muted">Loading…</p>}
        </Card>
        <Card title="Top losers">
          {(overview?.losers ?? []).slice(0, 8).map((m) => (
            <MoverRow key={m.symbol} m={m} onPick={lookup} />
          ))}
        </Card>
        <Card title="Most active">
          {(overview?.mostActive ?? []).slice(0, 8).map((m) => (
            <button
              key={m.symbol}
              onClick={() => lookup(m.symbol)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-white/5"
            >
              <span className="font-semibold">{m.symbol}</span>
              <span className="text-xs text-ink-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                {(m.volume / 1e6).toFixed(1)}M vol
              </span>
            </button>
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
