"use client";

import { useMemo, useRef, useState } from "react";
import type { ValuePoint } from "@/lib/types";
import { shortDate, usd } from "@/lib/format";

const W = 720;
const H = 220;
const PAD = { top: 12, right: 12, bottom: 24, left: 52 };

export function ValueChart({ points }: { points: ValuePoint[] }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const { xs, ys, path, ticks } = useMemo(() => {
    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const lo = min - span * 0.15;
    const hi = max + span * 0.1;
    const toY = (v: number) =>
      PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);
    const xs = points.map(
      (_, i) =>
        PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right)
    );
    const ys = values.map(toY);
    const path = xs.map((x, i) => `${i ? "L" : "M"}${x},${ys[i]}`).join("");
    const step = Math.ceil(span / 3 / 100) * 100;
    const first = Math.ceil(lo / step) * step;
    const ticks: { value: number; y: number }[] = [];
    for (let v = first; v <= hi; v += step) ticks.push({ value: v, y: toY(v) });
    return { xs, ys, path, ticks };
  }, [points]);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Infinity;
    xs.forEach((px, i) => {
      const d = Math.abs(px - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setHover(best);
  }

  const h = hover;

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Portfolio value over the last two months"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t.value}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={t.y}
              y2={t.y}
              stroke="var(--grid)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={t.y + 3.5}
              textAnchor="end"
              fontSize={11}
              fill="var(--ink-muted)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {usd(t.value, { cents: false })}
            </text>
          </g>
        ))}
        {[0, Math.floor(points.length / 2), points.length - 1].map((i) => (
          <text
            key={i}
            x={xs[i]}
            y={H - 6}
            textAnchor={
              i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"
            }
            fontSize={11}
            fill="var(--ink-muted)"
          >
            {shortDate(points[i].date)}
          </text>
        ))}
        <path
          d={path}
          fill="none"
          stroke="var(--series-1)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {h !== null && (
          <g>
            <line
              x1={xs[h]}
              x2={xs[h]}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="var(--baseline)"
              strokeWidth={1}
            />
            <circle
              cx={xs[h]}
              cy={ys[h]}
              r={4}
              fill="var(--series-1)"
              stroke="var(--surface)"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>
      {h !== null && (
        <div
          className="pointer-events-none absolute -top-1 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-xs shadow-sm"
          style={{
            left: `${(xs[h] / W) * 100}%`,
            transform:
              xs[h] > W * 0.7 ? "translateX(-105%)" : "translateX(8px)",
          }}
        >
          <div className="text-ink-muted">{shortDate(points[h].date)}</div>
          <div
            className="font-semibold"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {usd(points[h].value)}
          </div>
        </div>
      )}
    </div>
  );
}
