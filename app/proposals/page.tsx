"use client";

import { useEffect, useState } from "react";
import {
  approveDecision,
  getDecisions,
  rejectDecision,
  runResearchCycle,
} from "@/lib/api";
import { Card, SafeguardList, StatusBadge } from "@/components/ui";
import { dateTime, usd } from "@/lib/format";
import { decisions as mockDecisions } from "@/lib/mock";
import type { Decision } from "@/lib/types";

export default function ProposalsPage() {
  const [decisions, setDecisions] = useState<Decision[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [researching, setResearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    getDecisions()
      .then(setDecisions)
      .catch(() => {
        setOffline(true);
        setDecisions(mockDecisions);
      });
  }, []);

  async function research() {
    setResearching(true);
    setNote(null);
    try {
      const d = await runResearchCycle();
      setDecisions((prev) => [d, ...(prev ?? [])]);
      setNote(
        d.status === "proposed"
          ? "Research cycle complete — a new trade is waiting for your approval."
          : d.action === "hold"
            ? "Research cycle complete — the agent decided to hold."
            : "Research cycle complete — the proposal was blocked by a safeguard."
      );
    } catch {
      setNote("Couldn't run a research cycle — is the backend reachable?");
    }
    setResearching(false);
  }

  async function resolve(id: string, action: "approve" | "reject") {
    setBusyId(id);
    try {
      const updated =
        action === "approve" ? await approveDecision(id) : await rejectDecision(id);
      setDecisions((prev) =>
        (prev ?? []).map((d) => (d.id === id ? updated : d))
      );
    } catch {
      setNote(`Couldn't ${action} — is the backend reachable?`);
    }
    setBusyId(null);
  }

  const all = decisions ?? [];
  const pending = all.filter((d) => d.status === "proposed");
  const resolved = all.filter((d) => d.status !== "proposed");

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Trade proposals
          </h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            {offline
              ? "Sample data — backend unreachable"
              : "Every proposed order shows its evidence and safeguard checks. Nothing is submitted to the paper account until you approve it."}
          </p>
        </div>
        {!offline && (
          <button
            onClick={research}
            disabled={researching}
            className="rounded-lg bg-series-1 px-3.5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {researching ? "Researching… (~30s)" : "Run research cycle"}
          </button>
        )}
      </header>

      {note && <p className="text-sm text-ink-2">{note}</p>}
      {decisions === null && !offline && (
        <div className="h-40 animate-pulse rounded-xl bg-ink/5 dark:bg-white/10" />
      )}

      {decisions !== null && pending.length === 0 && (
        <Card>
          <p className="text-sm text-ink-2">
            No trades waiting for approval. Run a research cycle — the agent
            reads live prices and news, then proposes a trade only if it passes
            your safeguards.
          </p>
        </Card>
      )}

      {pending.map((d) => (
        <ProposalCard
          key={d.id}
          decision={d}
          busy={busyId === d.id}
          onResolve={offline ? undefined : (a) => resolve(d.id, a)}
        />
      ))}

      {resolved.length > 0 && (
        <h2 className="mt-2 text-sm font-semibold text-ink-muted">
          Recently resolved
        </h2>
      )}
      {resolved.slice(0, 8).map((d) => (
        <ProposalCard key={d.id} decision={d} busy={false} />
      ))}
    </div>
  );
}

function ProposalCard({
  decision: d,
  busy,
  onResolve,
}: {
  decision: Decision;
  busy: boolean;
  onResolve?: (action: "approve" | "reject") => void;
}) {
  const title =
    d.action === "hold" || d.action === "no_action" || !d.symbol
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
              onClick={() => onResolve("approve")}
              disabled={busy}
              className="rounded-lg bg-series-1 px-3.5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Submitting…" : "Approve"}
            </button>
            <button
              onClick={() => onResolve("reject")}
              disabled={busy}
              className="rounded-lg border border-hairline px-3.5 py-2 text-sm font-medium text-ink-2 hover:bg-ink/[0.04] disabled:opacity-50 dark:hover:bg-white/5"
            >
              Reject
            </button>
          </div>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-2">{d.rationale}</p>

      {d.evidence.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium text-ink-muted">
            Evidence — {d.evidence.length} item{d.evidence.length > 1 ? "s" : ""}
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {d.evidence.map((e, i) => (
              <li
                key={i}
                className="rounded-lg border border-hairline bg-page px-3 py-2 text-sm"
              >
                <div className="break-all text-xs text-ink-muted">
                  {e.source} · {dateTime(e.timestamp)}
                </div>
                <div className="mt-0.5 break-all text-ink-2">{e.summary}</div>
              </li>
            ))}
          </ul>
        </details>
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
          Paper order <span className="font-medium">{d.order.id.slice(0, 8)}</span>{" "}
          {d.order.status}
          {d.order.fillPrice ? ` @ ${usd(d.order.fillPrice)}` : ""} ·{" "}
          {dateTime(d.order.filledAt ?? d.order.submittedAt)}
          {d.order.status === "accepted" && (
            <span className="text-ink-muted">
              {" "}
              — market closed; fills at the next open
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
