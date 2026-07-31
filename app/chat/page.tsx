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
import { ChatMarkdown } from "@/components/chat-markdown";
import { dateTime } from "@/lib/format";
import type { ChatMessage } from "@/lib/types";
import { useToast } from "@/components/toast";

const SUGGESTED = [
  "What are you watching right now?",
  "Why are you holding cash?",
  "How did my preferences affect the last trade?",
  "What have you done this week?",
];

const OFFLINE_REPLY =
  "I can't reach my backend right now, so I can't answer from my decision records. Start the backend (backend/ on port 8000) or check NEXT_PUBLIC_API_URL, then ask me again.";

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [pending, setPending] = useState<Decision[]>([]);
  const [recent, setRecent] = useState<Decision[]>([]);
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
          const running = rs.find((r) => r.status === "running") ?? null;
          setActiveRun((prev) => {
            if (prev && !running) {
              const done = rs.find((r) => r.id === prev.id);
              toast(
                done?.status === "error" ? "error" : "success",
                done?.status === "error"
                  ? `Research failed: ${done.error ?? "unknown error"}`
                  : "Research complete — findings and order tickets are in."
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
        ? `Approving ${d.symbol} — submitting to your paper account…`
        : `Rejected ${d.symbol}.`
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
            ? `${d.symbol} blocked — conditions changed; see Proposals for the checks.`
            : `${d.symbol} order ${updated.order?.status ?? "accepted"} by Alpaca.`
        );
    } catch {
      toast("error", `Couldn't ${action} ${d.symbol} — see the Proposals page.`);
    }
  }

  useEffect(() => {
    getThreads()
      .then((ts) => {
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
      if (res.strategyUpdated) toast("success", "Strategy updated from this conversation.");
      if (!threadId) {
        setThreadId(res.threadId);
        getThreads().then(setThreads).catch(() => {});
      } else if (thread.length === 1) {
        getThreads().then(setThreads).catch(() => {});
      }
    } catch (e) {
      if (isSignedOut(e)) {
        reply =
          "You're not signed in — sign in (link in the sidebar) and I'll answer from your own account records.";
      } else {
        // The reply may still be completing server-side — keep listening.
        toast("info", "Taking longer than usual — still listening for the reply…");
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
        toast("error", "No reply came through — please send that again.");
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
          + New chat
        </button>
        <div className="mb-1 px-1 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          Conversations
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
            <p className="px-3 text-xs text-ink-muted">No conversations yet.</p>
          )}
        </nav>
        <div className="mb-1 mt-5 px-1 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          Trades & research
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
                    ? `${d.action === "sell" ? "Sell" : "Buy"} ${d.qty} ${d.symbol}`
                    : d.action === "rebalance"
                      ? "Portfolio plan"
                      : "Hold"}
                </span>
                <span className="ml-auto shrink-0 text-[10px] text-ink-muted">
                  {d.status}
                </span>
              </span>
            </a>
          ))}
          {recent.length > 0 && (
            <a
              href="/proposals"
              className="px-3 pt-1 text-[11px] font-medium text-series-1 hover:underline"
            >
              Full history & evidence →
            </a>
          )}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Ask the analyst
          </h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            Interrogate any decision. The agent answers from its recorded
            evidence and safeguard results — never from a made-up explanation.
          </p>
        </div>
        <button
          onClick={startNewChat}
          className="btn-ghost px-3.5 py-2 text-sm font-medium  lg:hidden dark:hover:bg-white/5"
        >
          + New chat
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
            Ask about the live paper account — positions, cash, any recorded
            decision, or what the agent is watching. Try a suggestion below.
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
              {m.role === "agent" ? "Analyst · " : ""}
              {dateTime(m.at)}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex items-center gap-1.5 rounded-3xl rounded-bl-md bg-surface px-4 py-3 text-sm text-ink-muted self-start">
            <span className="size-1.5 animate-pulse rounded-full bg-ink-muted" />
            <span className="size-1.5 animate-pulse rounded-full bg-ink-muted [animation-delay:150ms]" />
            <span className="size-1.5 animate-pulse rounded-full bg-ink-muted [animation-delay:300ms]" />
            <span className="ml-1">Reading the records…</span>
          </div>
        )}
      </div>

      {activeRun && (
        <div className="shrink-0 rounded-2xl bg-surface px-5 py-3.5">
          <div className="flex items-center gap-2 text-sm">
            <span aria-hidden className="size-2 animate-pulse rounded-full bg-accent" />
            <span className="font-medium">Research in progress</span>
            <span
              className="ml-auto text-xs text-ink-muted"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {elapsed}s
            </span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-baseline">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear"
              style={{ width: `${Math.max(4, progressPct)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            Scanning live prices, news, movers, and indicators — usually about a
            minute. Findings and order tickets post here the moment it finishes.
          </p>
        </div>
      )}

      {pending.length > 0 && (
        <div className="shrink-0 border-t border-hairline pt-3">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-ink-muted">
            <span>Trades awaiting your approval</span>
            <a href="/proposals" className="font-medium text-series-1 hover:underline">
              Full details & history →
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
            placeholder="Ask about any decision, position, or signal…"
            className="flex-1 rounded-lg border border-hairline bg-surface px-3.5 py-2.5 text-sm outline-none placeholder:text-ink-muted focus:border-series-1"
          />
          <button
            type="submit"
            disabled={thinking}
            className="btn-primary px-4 py-2 text-sm font-medium  disabled:opacity-50"
          >
            Send
          </button>
        </form>
        <p className="mt-2 text-xs text-ink-muted">
          Answers are grounded in the live paper account and the agent&apos;s
          recorded decisions. Simulated — not financial advice.
        </p>
      </div>
      </div>
    </div>
  );
}
