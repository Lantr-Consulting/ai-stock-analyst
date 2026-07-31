"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  approveDecision,
  getDecisions,
  getResearchRuns,
  isSignedOut,
  rejectDecision,
  runResearchCycle,
  steerRun,
  type ResearchRun,
} from "@/lib/api";
import { Card, SafeguardList, StatusBadge } from "@/components/ui";
import { dateTime, usd } from "@/lib/format";
import { decisions as mockDecisions } from "@/lib/mock";
import { useToast } from "@/components/toast";
import type { Decision } from "@/lib/types";

export default function ProposalsPage() {
  const [decisions, setDecisions] = useState<Decision[] | null>(null);
  const [status, setStatus] = useState<"live" | "signedOut" | "offline">("live");
  const [researching, setResearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [runs, setRuns] = useState<ResearchRun[]>([]);
  const toast = useToast();
  const [steerText, setSteerText] = useState("");
  const offline = status !== "live";
  const activeRun = runs.find((r) => r.status === "running");

  useEffect(() => {
    if (!activeRun) return;
    const t = setInterval(() => {
      getResearchRuns()
        .then((rs) => {
          setRuns(rs);
          const done = rs.find((r) => r.id === activeRun.id && r.status !== "running");
          if (done) {
            getDecisions().then(setDecisions).catch(() => {});
            setResearching(false);
            setNote(
              done.status === "error"
                ? `Research run failed: ${done.error ?? "unknown error"}`
                : "Research complete — the plan and proposals are below."
            );
            toast(
              done.status === "error" ? "error" : "success",
              done.status === "error"
                ? "Research run failed — see details on the page."
                : "Research complete — new proposals are ready."
            );
          }
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [activeRun?.id, activeRun]);

  useEffect(() => {
    const load = () => {
      getResearchRuns().then(setRuns).catch(() => {});
      return getDecisions()
        .then(setDecisions)
        .catch((e) => {
          setStatus(isSignedOut(e) ? "signedOut" : "offline");
          setDecisions((prev) => prev ?? mockDecisions);
        });
    };
    load();
    const onFocus = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  async function research() {
    setResearching(true);
    setNote(null);
    try {
      await runResearchCycle();
      const rs = await getResearchRuns();
      setRuns(rs);
      setNote("Research started — it keeps running even if you leave this page.");
      toast("info", "Research started — the agent is reading the market now.");
    } catch (e) {
      setResearching(false);
      setNote(
        e instanceof Error && e.message.includes("activate")
          ? "Finish agent setup first — describe how you invest and activate your agent."
          : e instanceof Error && e.message.includes("already running")
            ? "A research cycle is already running — results appear when it finishes."
            : "Couldn't run a research cycle — is the backend reachable?"
      );
    }
  }

  async function resolve(id: string, action: "approve" | "reject", reason?: string) {
    setBusyId(id);
    const before = decisions;
    // Optimistic: reflect the action instantly, reconcile with the server after.
    setDecisions((prev) =>
      (prev ?? []).map((d) =>
        d.id === id
          ? { ...d, status: action === "approve" ? "approved" : "rejected", feedback: reason ?? d.feedback }
          : d
      )
    );
    toast(
      "info",
      action === "approve"
        ? "Approved — submitting the order to your paper account…"
        : "Rejected — the agent will factor this into future research."
    );
    try {
      const updated =
        action === "approve"
          ? await approveDecision(id)
          : await rejectDecision(id, reason);
      setDecisions((prev) =>
        (prev ?? []).map((d) => (d.id === id ? updated : d))
      );
      if (action === "approve") {
        toast(
          updated.status === "blocked" ? "error" : "success",
          updated.status === "filled"
            ? `Order filled${updated.order?.fillPrice ? ` @ $${updated.order.fillPrice}` : ""}.`
            : updated.status === "blocked"
              ? "Order blocked — conditions changed since the proposal. See the safeguard checks."
              : "Order accepted by Alpaca — it fills when the market opens."
        );
      }
    } catch {
      setDecisions(before);
      toast("error", `Couldn't ${action} — check your connection and try again.`);
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
            {status === "signedOut" ? (
              <>
                Sample data —{" "}
                <Link href="/signin" className="font-medium text-series-1 hover:underline">
                  sign in
                </Link>{" "}
                to run your own agent
              </>
            ) : status === "offline" ? (
              "Sample data — backend unreachable"
            ) : (
              "Every proposed order shows its evidence and safeguard checks. Nothing is submitted to the paper account until you approve it."
            )}
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

      {activeRun && (
        <Card className="ring-1 ring-series-1/40">
          <div className="flex items-center gap-2 text-sm">
            <span className="size-2 animate-pulse rounded-full bg-series-1" />
            <span className="font-medium">Research in progress</span>
            <span className="text-ink-muted">
              started {dateTime(activeRun.started_at)} — reading prices, news,
              movers, and indicators…
            </span>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!steerText.trim()) return;
              try {
                const r = await steerRun(activeRun.id, steerText.trim());
                toast("success", r.note);
                setSteerText("");
              } catch {
                setNote("Couldn't save steering — try again.");
              }
            }}
            className="mt-3 flex gap-2"
          >
            <input
              value={steerText}
              onChange={(e) => setSteerText(e.target.value)}
              placeholder="Steer the research… e.g. 'focus on small-cap AI names today'"
              className="flex-1 rounded-lg border border-hairline bg-page px-3.5 py-2 text-sm outline-none placeholder:text-ink-muted focus:border-series-1"
            />
            <button
              type="submit"
              className="rounded-lg border border-hairline px-3.5 py-2 text-sm font-medium text-ink-2 hover:bg-ink/[0.04] dark:hover:bg-white/5"
            >
              Steer
            </button>
          </form>
        </Card>
      )}
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
          onResolve={offline ? undefined : (a, r) => resolve(d.id, a, r)}
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
  onResolve?: (action: "approve" | "reject", reason?: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
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
              onClick={() => setRejecting(true)}
              disabled={busy}
              className="rounded-lg border border-hairline px-3.5 py-2 text-sm font-medium text-ink-2 hover:bg-ink/[0.04] disabled:opacity-50 dark:hover:bg-white/5"
            >
              Reject
            </button>
          </div>
        )}
      </div>

      {rejecting && d.status === "proposed" && onResolve && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onResolve("reject", reason.trim() || undefined);
          }}
          className="mt-3 flex gap-2"
        >
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why? (optional — the agent learns from this)"
            className="flex-1 rounded-lg border border-hairline bg-page px-3.5 py-2 text-sm outline-none placeholder:text-ink-muted focus:border-series-1"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-critical px-3.5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Rejecting…" : "Confirm reject"}
          </button>
        </form>
      )}

      <p className="mt-3 text-sm leading-relaxed text-ink-2">{d.rationale}</p>

      {d.status === "rejected" && d.feedback && (
        <p className="mt-2 rounded-lg bg-critical/5 px-3 py-2 text-sm text-ink-2">
          <span className="font-medium">Your reason:</span> {d.feedback} —
          future research cycles take this into account.
        </p>
      )}

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
