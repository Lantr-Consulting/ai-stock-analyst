"use client";

import { useEffect, useState } from "react";
import {
  approveDecision,
  askAnalyst,
  getChatHistory,
  getDecisions,
  getResearchRuns,
  getThreads,
  isSignedOut,
  newThread,
  rejectDecision,
  type ResearchRun,
  type Thread,
} from "@/lib/api";
import type { Decision } from "@/lib/types";
import { OrderCard } from "@/components/order-card";
import { updateSettings } from "@/lib/api";
import { ChatMarkdown } from "@/components/chat-markdown";
import { dateTime } from "@/lib/format";
import type { ChatMessage } from "@/lib/types";
import { useToast } from "@/components/toast";

const SUGGESTED = [
  "你现在重点关注哪些标的？",
  "为什么组合里保留了这些现金？",
  "我的投资偏好如何影响了上一条建议？",
  "这周你做了哪些研究？",
];

const OFFLINE_REPLY =
  "暂时无法连接研究服务，因此不能根据你的决策记录作答。请稍后重新发送。";

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [pending, setPending] = useState<Decision[]>([]);
  const [recent, setRecent] = useState<Decision[]>([]);
  const [dismissedSuggestion, setDismissedSuggestion] = useState<string | null>(null);
  const [activeRun, setActiveRun] = useState<ResearchRun | null>(null);
  const [, setTick] = useState(0);
  const toast = useToast();

  // Poll for pending trades, fresh messages, and live research status.
  useEffect(() => {
    const load = () => {
      getDecisions()
        .then((ds) => {
          setPending(ds.filter((d) => d.status === "proposed"));
          setRecent(ds);
        })
        .catch(() => {});
      getResearchRuns()
        .then((rs) => {
          const running = rs.find((r) => r.status === "running" && !r.automation_id) ?? null;
          setActiveRun((prev) => {
            if (prev && !running) {
              const done = rs.find((r) => r.id === prev.id);
              toast(
                done?.status === "error" ? "error" : "success",
                done?.status === "error"
                  ? `研究失败：${done.error ?? "未知错误"}`
                  : "研究已完成，结论和模拟订单建议已经生成。"
              );
              if (threadId)
                getChatHistory(threadId).then(setMessages).catch(() => {});
            }
            return running;
          });
        })
        .catch(() => {});
    };
    load();
    const t = setInterval(() => {
      load();
      if (threadId && !thinking) {
        getChatHistory(threadId)
          .then((h) => setMessages((prev) => (h.length > prev.length ? h : prev)))
          .catch(() => {});
      }
    }, 5000);
    return () => clearInterval(t);
  }, [threadId, thinking, toast]);

  // 1-second tick so the progress bar and timer advance smoothly.
  useEffect(() => {
    if (!activeRun) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [activeRun?.id, activeRun]);

  const elapsed = activeRun
    ? Math.max(0, Math.floor((Date.now() - new Date(activeRun.started_at).getTime()) / 1000))
    : 0;
  const progressPct = Math.min(95, Math.round((elapsed / 90) * 100));

  async function resolveInline(d: Decision, action: "approve" | "reject", qty?: number) {
    setPending((p) => p.filter((x) => x.id !== d.id));
    toast(
      "info",
      action === "approve"
        ? `正在确认 ${d.symbol}，并向模拟账户提交…`
        : `已拒绝 ${d.symbol}。`
    );
    try {
      const updated =
        action === "approve"
          ? await approveDecision(d.id, qty)
          : await rejectDecision(d.id);
      if (action === "approve")
        toast(
          updated.status === "blocked" ? "error" : "success",
          updated.status === "blocked"
            ? `${d.symbol} 已被风控拦截；市场条件发生变化，请到研究助手查看检查结果。`
            : `${d.symbol} 模拟订单已由 Alpaca ${updated.order?.status === "filled" ? "成交" : "接收"}。`
        );
    } catch {
      toast("error", `${action === "approve" ? "确认" : "拒绝"} ${d.symbol} 失败，请到研究助手页面重试。`);
    }
  }

  useEffect(() => {
    const ask = new URLSearchParams(window.location.search).get("ask");
    if (ask) setDraft(ask);
    getThreads()
      .then(async (ts) => {
        if (ask) {
          // A handoff from Discover starts its own fresh conversation.
          try {
            const t = await newThread();
            setThreads([t, ...ts]);
            setThreadId(t.id);
            setMessages([]);
            return;
          } catch {}
        }
        setThreads(ts);
        if (ts.length > 0) setThreadId(ts[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!threadId) return;
    getChatHistory(threadId)
      .then((h) => setMessages(h))
      .catch(() => {});
  }, [threadId]);

  async function startNewChat() {
    try {
      const t = await newThread();
      setThreads((ts) => [t, ...ts]);
      setThreadId(t.id);
      setMessages([]);
    } catch {}
  }

  async function send(text: string) {
    const t = text.trim();
    if (!t || thinking) return;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: t,
      at: new Date().toISOString(),
    };
    const thread = [...messages, userMsg];
    setMessages(thread);
    setDraft("");
    setThinking(true);
    let reply: string;
    try {
      const res = await askAnalyst(thread, threadId ?? undefined);
      reply = res.text;
      if (res.strategyUpdated) toast("success", "已根据本次对话更新研究策略。 ");
      if (!threadId) {
        setThreadId(res.threadId);
        getThreads().then(setThreads).catch(() => {});
      } else if (thread.length === 1) {
        getThreads().then(setThreads).catch(() => {});
      }
    } catch (e) {
      if (isSignedOut(e)) {
        reply =
          "你还没有登录。请先通过侧栏登录，我才能根据你的账户记录作答。";
      } else {
        // The reply may still be completing server-side — keep listening.
        toast("info", "本次回复耗时较长，仍在等待研究结果…");
        const since = userMsg.at;
        for (let i = 0; i < 15; i++) {
          await new Promise((r) => setTimeout(r, 4000));
          try {
            const h = await getChatHistory(threadId ?? undefined);
            const last = h[h.length - 1];
            if (last && last.role === "agent" && last.at > since) {
              setMessages(h);
              setThinking(false);
              return;
            }
          } catch {}
        }
        toast("error", "暂时没有收到回复，请重新发送一次。 ");
        setThinking(false);
        return;
      }
    }
    setMessages((m) => [
      ...m,
      {
        id: `a-${Date.now()}`,
        role: "agent",
        text: reply,
        at: new Date().toISOString(),
      },
    ]);
    setThinking(false);
  }

  return (
    <div className="flex min-h-0 flex-1 gap-6">
      <aside className="order-last w-56 shrink-0 self-start sticky top-0 max-h-full overflow-y-auto max-lg:hidden">
        <button
          onClick={startNewChat}
          className="mb-3 w-full btn-ghost px-3 py-2 text-sm font-medium  dark:hover:bg-white/5"
        >
          + 新对话
        </button>
        <div className="mb-1 px-1 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          对话记录
        </div>
        <nav className="flex flex-col gap-0.5">
          {threads.map((t) => (
            <button
              key={t.id}
              onClick={() => setThreadId(t.id)}
              className={`truncate rounded-lg px-3 py-2 text-left text-sm ${
                t.id === threadId
                  ? "bg-ink/[0.06] font-medium text-ink dark:bg-white/10"
                  : "text-ink-2 hover:bg-ink/[0.04] dark:hover:bg-white/5"
              }`}
            >
              {t.title}
            </button>
          ))}
          {threads.length === 0 && (
            <p className="px-3 text-xs text-ink-muted">还没有对话。</p>
          )}
        </nav>
        <div className="mb-1 mt-5 px-1 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          交易与研究
        </div>
        <div className="flex flex-col gap-0.5">
          {recent.slice(0, 10).map((d) => (
            <a
              key={d.id}
              href="/proposals"
              className="rounded-lg px-3 py-1.5 hover:bg-white/5"
            >
              <span className="flex items-center gap-1.5 text-xs">
                <span
                  aria-hidden
                  className={`size-1.5 shrink-0 rounded-full ${
                    d.status === "filled" || d.status === "approved"
                      ? "bg-good"
                      : d.status === "proposed"
                        ? "animate-pulse bg-accent"
                        : d.status === "blocked"
                          ? "bg-critical"
                          : "bg-baseline"
                  }`}
                />
                <span className="truncate text-ink-2">
                  {d.symbol
                    ? `${d.action === "sell" ? "卖出" : "买入"} ${d.qty} 股 ${d.symbol}`
                    : d.action === "rebalance"
                      ? "组合调整方案"
                      : "继续持有"}
                </span>
                <span className="ml-auto shrink-0 text-[10px] text-ink-muted">
                  {decisionStatus(d.status)}
                </span>
              </span>
            </a>
          ))}
          {recent.length > 0 && (
            <a
              href="/proposals"
              className="px-3 pt-1 text-[11px] font-medium text-series-1 hover:underline"
            >
              查看完整记录与依据 →
            </a>
          )}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            研究对话
          </h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            可以追问任何一条决策。助手只根据已记录的研究依据和风控结果回答，不编造解释。
          </p>
        </div>
        <button
          onClick={startNewChat}
          className="btn-ghost px-3.5 py-2 text-sm font-medium  lg:hidden dark:hover:bg-white/5"
        >
          + 新对话
        </button>
      </header>

      {threads.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
          {threads.slice(0, 8).map((t) => (
            <button
              key={t.id}
              onClick={() => setThreadId(t.id)}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs ${
                t.id === threadId
                  ? "border-series-1 bg-series-1/10 font-medium text-ink"
                  : "border-hairline text-ink-2 hover:bg-ink/[0.04] dark:hover:bg-white/5"
              }`}
            >
              {t.title}
            </button>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
        {messages.length === 0 && !thinking && (
          <div className="rounded-xl border border-dashed border-hairline px-5 py-8 text-center text-sm text-ink-muted">
            可以询问模拟账户的持仓、现金、历史决策或当前关注方向，也可以从下方问题开始。
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[85%] text-sm leading-relaxed animate-[msg-in_.18s_ease-out] ${
                m.role === "user"
                  ? "rounded-3xl rounded-br-md bg-accent px-4 py-2.5 font-medium text-black"
                  : "rounded-3xl rounded-bl-md bg-surface px-4.5 py-3 text-ink shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]"
              }`}
            >
              {m.role === "agent" ? <ChatMarkdown text={m.text} /> : m.text}
            </div>
            <div className="mt-1 px-1 text-[11px] text-ink-muted">
              {m.role === "agent" ? "研究助手 · " : ""}
              {dateTime(m.at)}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex items-center gap-1.5 rounded-3xl rounded-bl-md bg-surface px-4 py-3 text-sm text-ink-muted self-start">
            <span className="size-1.5 animate-pulse rounded-full bg-ink-muted" />
            <span className="size-1.5 animate-pulse rounded-full bg-ink-muted [animation-delay:150ms]" />
            <span className="size-1.5 animate-pulse rounded-full bg-ink-muted [animation-delay:300ms]" />
            <span className="ml-1">正在查阅记录…</span>
          </div>
        )}
      </div>

      {(() => {
        const LABELS: Record<string, string> = {
          maxOrderPct: "单笔订单上限",
          maxPositionPct: "单一标的仓位上限",
          minCashPct: "最低现金比例",
          maxTradesPerDay: "每日交易上限",
        };
        const rec = recent.find(
          (d) => !d.symbol && d.feedback?.startsWith('{"suggest"')
        );
        if (!rec || rec.id === dismissedSuggestion) return null;
        let parsed: { suggest: Record<string, number>; why: string };
        try {
          parsed = JSON.parse(rec.feedback!);
        } catch {
          return null;
        }
        const entries = Object.entries(parsed.suggest);
        if (entries.length === 0) return null;
        return (
          <div className="shrink-0 rounded-2xl border border-accent/40 bg-surface px-5 py-4">
            <div className="text-sm font-bold">
              研究助手建议调整一项风控限制
            </div>
            <p className="mt-1 text-xs leading-relaxed text-ink-2">
              部分研究结果不符合你当前设置的限制：{" "}
              {parsed.why}
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {entries.map(([k, v]) => (
                <li
                  key={k}
                  className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent"
                >
                  {LABELS[k] ?? k}: {v}
                  {k === "maxTradesPerDay" ? " 笔/日" : "%"}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <button
                onClick={async () => {
                  try {
                    await updateSettings({ safeguards: parsed.suggest });
                    setDismissedSuggestion(rec.id);
                    toast(
                      "success",
                      "风控设置已更新。再次运行研究后，助手会按新限制重新判断。"
                    );
                  } catch {
                    toast("error", "暂时无法更新风控设置，请稍后再试。 ");
                  }
                }}
                className="btn-primary px-4 py-2 text-sm"
              >
                应用调整
              </button>
              <button
                onClick={() => setDismissedSuggestion(rec.id)}
                className="btn-ghost px-4 py-2 text-sm"
              >
                保持原设置
              </button>
            </div>
          </div>
        );
      })()}

      {activeRun && (
        <div className="shrink-0 rounded-2xl bg-surface px-5 py-3.5">
          <div className="flex items-center gap-2 text-sm">
            <span aria-hidden className="size-2 animate-pulse rounded-full bg-accent" />
            <span className="font-medium">正在研究</span>
            <span
              className="ml-auto text-xs text-ink-muted"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {elapsed} 秒
            </span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-baseline">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear"
              style={{ width: `${Math.max(4, progressPct)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            正在读取实时价格、新闻、异动和技术指标，通常需要约一分钟。完成后会立即显示结论和模拟订单建议。
          </p>
        </div>
      )}

      {pending.length > 0 && (
        <div className="shrink-0 border-t border-hairline pt-3">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-ink-muted">
            <span>待你确认的模拟交易</span>
            <a href="/proposals" className="font-medium text-series-1 hover:underline">
              查看详情与历史 →
            </a>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {pending.map((d) => (
              <OrderCard
                key={d.id}
                decision={d}
                busy={false}
                onApprove={(qty) => resolveInline(d, "approve", qty)}
                onReject={() => resolveInline(d, "reject")}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto shrink-0 pt-2">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {SUGGESTED.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={thinking}
              className="rounded-full border border-hairline bg-surface px-3 py-1 text-xs text-ink-2 hover:bg-ink/[0.04] disabled:opacity-50 dark:hover:bg-white/5"
            >
              {s}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          className="flex gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="询问任何决策、持仓或市场信号…"
            className="flex-1 rounded-lg border border-hairline bg-surface px-3.5 py-2.5 text-sm outline-none placeholder:text-ink-muted focus:border-series-1"
          />
          <button
            type="submit"
            disabled={thinking}
            className="btn-primary px-4 py-2 text-sm font-medium  disabled:opacity-50"
          >
            发送
          </button>
        </form>
        <p className="mt-2 text-xs text-ink-muted">
          回答基于模拟账户与已记录的研究决策；仅作项目演示，不构成投资建议。
        </p>
      </div>
      </div>
    </div>
  );
}

function decisionStatus(status: Decision["status"]) {
  return {
    proposed: "待确认",
    approved: "已确认",
    rejected: "已拒绝",
    blocked: "已拦截",
    filled: "已成交",
  }[status];
}

