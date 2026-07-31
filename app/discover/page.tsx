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
    positions: { symbol: string; price: number; pl?: number | null }[];
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
        let positions: { symbol: string; price: number; pl?: number | null }[] = [];
        try {
          const p = await getPortfolio();
          positions = p.positions.map((x) => ({
            symbol: x.symbol,
            price: x.price,
            pl: x.unrealizedPlPct,
          }));
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

      {detail && (() => {
        const closes = detail.bars.map((b) => b.close);
        const tfCloses =
          tf === "1W" ? closes.slice(-5) : tf === "1M" ? closes.slice(-21) : closes;
        const sym = detail.info.symbol;
        const est = (ind?.price ?? 0) * buyQty;
        return (
          <section className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold tracking-tight">
                {detail.info.name}
              </h2>
              {ind?.price != null && (
                <>
                  <div
                    className="mt-1 text-5xl font-bold tracking-tight"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {usd(ind.price)}
                  </div>
                  {ind.return30dPct != null && (
                    <div
                      className={`mt-1.5 text-sm font-semibold ${
                        ind.return30dPct >= 0 ? "text-delta-up" : "text-delta-down"
                      }`}
                    >
                      {ind.return30dPct >= 0 ? "+" : ""}
                      {ind.return30dPct}% past 30 days
                    </div>
                  )}
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
                    {t}
                  </button>
                ))}
                <span className="ml-auto text-[11px] font-normal text-ink-muted">
                  {sym} · {detail.info.exchange}
                  {detail.info.tradable ? "" : " · not tradable"}
                </span>
              </div>

              {detail.news.length > 0 && (
                <div className="mt-6">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                    News
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
              <div className="rounded-2xl bg-surface p-5">
                <h3 className="text-base font-bold tracking-tight">Buy {sym}</h3>
                <div className="mt-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Shares</span>
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
                    <span className="font-medium text-series-1">Market price</span>
                    <span className="font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {ind?.price != null ? usd(ind.price) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-hairline pt-3">
                    <span className="text-sm font-bold">Estimated cost</span>
                    <span className="text-sm font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {usd(est)}
                    </span>
                  </div>
                  <Link
                    href={`/chat?ask=${encodeURIComponent(
                      `Evaluate buying ${buyQty} shares of ${sym} (~${usd(est)}). Research it with live data and propose the order if it makes sense.`
                    )}`}
                    className="btn-primary w-full px-4 py-3 text-sm"
                  >
                    Send to analyst
                  </Link>
                  {canWatch && !watchlist.includes(sym) && (
                    <button onClick={() => addToWatchlist(sym)} className="btn-ghost w-full px-4 py-2.5 text-sm">
                      + Add to watchlist
                    </button>
                  )}
                  {watchlist.includes(sym) && (
                    <span className="inline-flex items-center justify-center rounded-full bg-series-1/15 px-3 py-2 text-xs font-medium text-series-1">
                      On your watchlist
                    </span>
                  )}
                  <p className="text-[11px] leading-relaxed text-ink-muted">
                    Your analyst researches and safeguard-checks every order
                    before it can be approved. Simulated paper trading.
                  </p>
                </div>
              </div>

              {ind && !ind.error && (
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="Trend" value={trendUp == null ? "—" : trendUp ? "Above SMA20" : "Below SMA20"} tone={trendUp == null ? "" : trendUp ? "text-delta-up" : "text-delta-down"} />
                  <Stat label="RSI 14" value={ind.rsi14 != null ? String(ind.rsi14) : "—"} tone={ind.rsi14 != null && ind.rsi14 < 35 ? "text-delta-up" : ind.rsi14 != null && ind.rsi14 > 70 ? "text-delta-down" : ""} />
                  <Stat label="Volatility" value={ind.annualizedVolPct != null ? `${ind.annualizedVolPct}%` : "—"} />
                  <Stat label="Drawdown 60d" value={ind.maxDrawdown60dPct != null ? `${ind.maxDrawdown60dPct}%` : "—"} />
                </div>
              )}
            </aside>
          </section>
        );
      })()}

      {(mine.positions.length > 0 || watchlist.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {mine.positions.length > 0 && (
            <Card title="Your stocks" className="!px-2 !py-4 [&>div]:px-3">
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
                    {p.pl != null && (
                      <span
                        className={`text-xs font-semibold ${p.pl >= 0 ? "text-delta-up" : "text-delta-down"}`}
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {p.pl >= 0 ? "+" : ""}
                        {p.pl.toFixed(2)}%
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </Card>
          )}
          {watchlist.length > 0 && (
            <Card title="Your watchlist" className="!px-2 !py-4 [&>div]:px-3">
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
                          {pct.toFixed(2)}% 30d
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
