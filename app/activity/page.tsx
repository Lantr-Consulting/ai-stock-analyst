import { Card } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { activity } from "@/lib/mock";
import type { ActivityKind } from "@/lib/types";

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

export default function ActivityPage() {
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Activity</h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          Every research cycle, proposal, approval, order, and fill — the
          agent&apos;s complete, auditable record.
        </p>
      </header>

      <Card>
        <ol className="relative flex flex-col">
          {activity.map((a, i) => (
            <li key={a.id} className="relative flex gap-4 pb-6 last:pb-0">
              {i < activity.length - 1 && (
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
      </Card>
    </div>
  );
}
