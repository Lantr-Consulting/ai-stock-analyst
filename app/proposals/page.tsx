"use client";

import { useState } from "react";
import { Card, SafeguardList, StatusBadge } from "@/components/ui";
import { dateTime, usd } from "@/lib/format";
import { decisions } from "@/lib/mock";
import type { Decision, DecisionStatus } from "@/lib/types";

export default function ProposalsPage() {
  const [overrides, setOverrides] = useState<Record<string, DecisionStatus>>(
    {}
  );

  const withStatus = (d: Decision): Decision => ({
    ...d,
    status: overrides[d.id] ?? d.status,
  });

  const all = decisions.map(withStatus);
  const pending = all.filter((d) => d.status === "proposed");
  const resolved = all.filter((d) => d.status !== "proposed");

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">
          Trade proposals
        </h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          Every proposed order shows its evidence and safeguard checks. Nothing
          is submitted to the paper account until you approve it.
        </p>
      </header>

      {pending.length === 0 && (
        <Card>
          <p className="text-sm text-ink-2">
            No trades waiting for approval. The agent will propose one when a
            research cycle finds an opportunity that passes your safeguards.
          </p>
        </Card>
      )}

      {pending.map((d) => (
        <ProposalCard
          key={d.id}
          decision={d}
          onResolve={(status) =>
            setOverrides((o) => ({ ...o, [d.id]: status }))
          }
        />
      ))}

      <h2 className="mt-2 text-sm font-semibold text-ink-muted">
        Recently resolved
      </h2>
      {resolved.map((d) => (
        <ProposalCard key={d.id} decision={d} />
      ))}
    </div>
  );
}

function ProposalCard({
  decision: d,
  onResolve,
}: {
  decision: Decision;
  onResolve?: (status: DecisionStatus) => void;
}) {
  const title =
    d.action === "hold" || d.action === "no_action"
      ? "Hold — no action"
      : `${d.action === "buy" ? "Buy" : d.action === "sell" ? "Sell" : "Rebalance"} ${d.qty ?? ""} ${d.symbol ?? ""}`.trim();

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-semibold tracking-tight">{title}</h3>
            <StatusBadge status={d.status} />
          </div>
          <div className="mt-0.5 text-xs text-ink-muted">
            {dateTime(d.createdAt)} · strategy v{d.strategyVersion}
            {d.estValue ? ` · est. ${usd(d.estValue)}` : ""}
          </div>
        </div>
        {d.status === "proposed" && onResolve && (
          <div className="flex gap-2">
            <button
              onClick={() => onResolve("approved")}
              className="rounded-lg bg-series-1 px-3.5 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Approve
            </button>
            <button
              onClick={() => onResolve("rejected")}
              className="rounded-lg border border-hairline px-3.5 py-2 text-sm font-medium text-ink-2 hover:bg-ink/[0.04] dark:hover:bg-white/5"
            >
              Reject
            </button>
          </div>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-2">{d.rationale}</p>

      {d.evidence.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-medium text-ink-muted">Evidence</div>
          <ul className="mt-2 flex flex-col gap-2">
            {d.evidence.map((e) => (
              <li
                key={e.summary}
                className="rounded-lg border border-hairline bg-page px-3 py-2 text-sm"
              >
                <div className="text-xs text-ink-muted">
                  {e.source} · {dateTime(e.timestamp)}
                </div>
                <div className="mt-0.5 text-ink-2">{e.summary}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {d.safeguards.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-medium text-ink-muted">
            Safeguard checks
          </div>
          <SafeguardList checks={d.safeguards} />
        </div>
      )}

      {d.order && (
        <div className="mt-4 rounded-lg border border-hairline bg-page px-3 py-2 text-sm text-ink-2">
          Paper order <span className="font-medium">{d.order.id}</span>{" "}
          {d.order.status}
          {d.order.fillPrice ? ` @ ${usd(d.order.fillPrice)}` : ""} ·{" "}
          {dateTime(d.order.filledAt ?? d.order.submittedAt)}
        </div>
      )}

      {d.status === "approved" && !d.order && onResolve && (
        <p className="mt-3 text-xs text-ink-muted">
          Sample mode — in the full version this order is now submitted to the
          Alpaca paper account and reconciled when it fills.
        </p>
      )}
    </Card>
  );
}
