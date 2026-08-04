"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDecisions, isSignedOut } from "@/lib/api";
import { Card } from "@/components/ui";
import { dateTime, usd } from "@/lib/format";
import { activity as mockActivity } from "@/lib/mock";
import type { ActivityEvent, ActivityKind, Decision } from "@/lib/types";

const KIND_META: Record<ActivityKind, { label: string; dot: string }> = {
  research: { label: "研究", dot: "var(--series-1)" },
  proposal: { label: "交易建议", dot: "var(--series-1)" },
  approval: { label: "人工确认", dot: "var(--good)" },
  order: { label: "订单", dot: "var(--series-3)" },
  fill: { label: "成交", dot: "var(--good)" },
  blocked: { label: "风控拦截", dot: "var(--critical)" },
  summary: { label: "小结", dot: "var(--series-4)" },
  profile: { label: "偏好", dot: "var(--series-5)" },
};

function toEvents(decisions: Decision[]): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  for (const d of decisions) {
    const what =
      d.action === "hold" || !d.symbol
        ? "继续持有，不操作"
        : `${d.action === "buy" ? "买入" : "卖出"} ${d.qty} 股 ${d.symbol}${d.estValue ? `（约 ${usd(d.estValue)}）` : ""}`;
    if (d.order) {
      events.push({
        id: `${d.id}-order`,
        at: d.order.filledAt ?? d.order.submittedAt,
        kind: d.order.status === "filled" ? "fill" : "order",
        title:
          d.order.status === "filled"
            ? `已成交：${what}${d.order.fillPrice ? `，成交价 ${usd(d.order.fillPrice)}` : ""}`
            : `模拟订单（${d.order.status}）：${what}`,
        detail: `模拟订单 ${d.order.id.slice(0, 8)} · 决策 ${d.id}`,
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
          ? `已被风控拦截：${what}`
          : d.action === "hold"
            ? "本轮研究结论：暂不操作"
            : `研究助手建议：${what}`,
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
        <h1 className="text-xl font-semibold tracking-tight">活动记录</h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          {status === "signedOut" ? (
            <>
              当前展示演示数据。{" "}
              <Link href="/signin" className="font-medium text-series-1 hover:underline">
                登录
              </Link>{" "}
              后可查看你的完整记录
            </>
          ) : status === "offline" ? (
            "暂时无法连接服务，当前展示演示数据"
          ) : (
            "从研究、建议到人工确认和模拟成交，每一步都留有可追溯记录。"
          )}
        </p>
      </header>

      <Card>
        {events === null ? (
          <div className="h-40 animate-pulse rounded-xl bg-ink/5 dark:bg-white/10" />
        ) : events.length === 0 ? (
          <p className="text-sm text-ink-2">
            暂无记录。前往“研究助手”发起一次研究，这里就会开始记录全过程。
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

