"use client";

import { useState } from "react";
import { usd } from "@/lib/format";
import type { Decision } from "@/lib/types";

/** Robinhood-style order ticket for a proposed trade — shares are editable;
 *  approval re-runs every safeguard against the edited size. */
export function OrderCard({
  decision: d,
  busy,
  onApprove,
  onReject,
}: {
  decision: Decision;
  busy: boolean;
  onApprove: (qty: number) => void;
  onReject: () => void;
}) {
  const proposedQty = Math.max(1, Math.round(d.qty ?? 1));
  const [qty, setQty] = useState(proposedQty);
  const price = d.estValue && d.qty ? d.estValue / d.qty : 0;
  const est = qty * price;

  return (
    <div className="overflow-hidden rounded-2xl bg-surface-2">
      <div className="border-b border-hairline px-5 py-4">
        <h3 className="text-lg font-bold tracking-tight">
          {d.action === "sell" ? "Sell" : "Buy"} {d.symbol}
        </h3>
        {d.rationale && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-2">
            {d.rationale}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 px-5 py-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Order type</span>
          <span className="text-ink-2">Market · proposed by your analyst</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Shares</span>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            className="w-24 rounded-lg border border-hairline bg-page px-3 py-1.5 text-right text-sm outline-none focus:border-accent"
            style={{ fontVariantNumeric: "tabular-nums" }}
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-series-1">Market price</span>
          <span className="font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
            {price ? usd(price) : "—"}
          </span>
        </div>
        <div className="border-t border-hairline pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">Estimated cost</span>
            <span className="text-sm font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
              {usd(est)}
            </span>
          </div>
          {qty !== proposedQty && (
            <p className="mt-1 text-right text-[11px] text-ink-muted">
              edited from {proposedQty} shares — safeguards re-check at this size
            </p>
          )}
        </div>
        <div className="mt-1 flex gap-2">
          <button
            onClick={() => onApprove(qty)}
            disabled={busy}
            className="btn-primary flex-1 px-4 py-3 text-sm"
          >
            {busy ? "Submitting…" : `Approve order`}
          </button>
          <button
            onClick={onReject}
            disabled={busy}
            className="btn-ghost px-4 py-3 text-sm"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
