"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDecisions, isSignedOut } from "@/lib/api";
import { Card } from "@/components/ui";
import { dateTime, usd } from "@/lib/format";
import { activity as mockActivity } from "@/lib/mock";
import type { ActivityEvent, ActivityKind, Decision } from "@/lib/types";

const KIND_META: Record<ActivityKind, { label: string; dot: string }> = {
  research: { label: "Research", dot: "var(--series-1)" },
  proposal: { label: "Proposal", dot: "var(--series-1)" },
  approval: { label: "Approval", dot: "var(--good)" },
  order: { label: "Order", dot: "var(--series-3)" },
  fill: { label: "Fill", dot: "var(--good)" },
  blocked: { label: "Blocked", dot: "var(--critical)" },
  summary: { label: "Summary", dot: "var(--series-4)" },
  profile: { label: "Profile", dot: "var(--series-5)" },
};

function toEvents(decisions: Decision[]): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  for (const d of decisions) {
    const what =
      d.action === "hold" || !d.symbol
        ? "Hold — no action"
        : `${d.action === "buy" ? "Buy" : "Sell"} ${d.qty} ${d.symbol}${d.estValue ? ` (~${usd(d.estValue)})` : ""}`;
    if (d.order) {
      events.push({
        id: `${d.id}-order`,
        at: d.order.filledAt ?? d.order.submittedAt,
        kind: d.order.status === "filled" ? "fill" : "order",
        title:
          d.order.status === "filled"
            ? `Filled: ${what}${d.order.fillPrice ? ` @ ${usd(d.order.fillPrice)}` : ""}`
            : `Order ${d.order.status}: ${what}`,
        detail: `Paper order ${d.order.id.slice(0, 8)} · decision ${d.id}`,
      });
    }
    const kind: ActivityKind =
      d.status === "blocked"
        ? "blocked"
        : d.action === "hold"
          ? "research"
          : "proposal";
    events.push({
      id: d.id,
      at: d.createdAt,
      kind,
      title:
        d.status === "blocked"
          ? `Blocked: ${what}`
          : d.action === "hold"
            ? "Research cycle — no action"
            : `Proposed: ${what}`,
      detail: d.rationale,
    });
  }
  return events.sort((a, b) => (a.at < b.at ? 1 : -1));
}

export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [status, setStatus] = useState<"live" | "signedOut" | "offline">("live");
  const offline = status !== "live";

  useEffect(() => {
    getDecisions()
      .then((d) => setEvents(toEvents(d)))
      .catch((e) => {
        setStatus(isSignedOut(e) ? "signedOut" : "offline");
        setEvents(mockActivity);
      });
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Activity</h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          {status === "signedOut" ? (
            <>
              Sample data —{" "}
              <Link href="/signin" className="font-medium text-series-1 hover:underline">
                sign in
              </Link>{" "}
              to see your own record
            </>
          ) : status === "offline" ? (
            "Sample data — backend unreachable"
          ) : (
            "Every research cycle, proposal, approval, order, and fill — the agent's complete, auditable record."
          )}
        </p>
      </header>

      <Card>
        {events === null ? (
          <div className="h-40 animate-pulse rounded-xl bg-ink/5 dark:bg-white/10" />
        ) : events.length === 0 ? (
          <p className="text-sm text-ink-2">
            Nothing yet — run a research cycle from the Proposals page and the
            record starts here.
          </p>
        ) : (
          <ol className="relative flex flex-col">
            {events.map((a, i) => (
              <li key={a.id} className="relative flex gap-4 pb-6 last:pb-0">
                {i < events.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute left-[5px] top-4 h-full w-px bg-grid"
                  />
                )}
                <span
                  aria-hidden
                  className="relative mt-1.5 inline-block size-[11px] shrink-0 rounded-full border-2 border-surface"
                  style={{ background: KIND_META[a.kind].dot }}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-medium">{a.title}</span>
                    <span className="text-xs text-ink-muted">
                      {KIND_META[a.kind].label} · {dateTime(a.at)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-ink-2">{a.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
