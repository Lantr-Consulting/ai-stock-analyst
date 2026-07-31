"use client";

import { useEffect, useState } from "react";
import {
  approveDecision,
  askAnalyst,
  getChatHistory,
  getDecisions,
  getThreads,
  isSignedOut,
  newThread,
  rejectDecision,
  type Thread,
} from "@/lib/api";
import type { Decision } from "@/lib/types";
import { usd } from "@/lib/format";
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
  const toast = useToast();

  // Inline proposals: poll for pending trades and fresh thread messages.
  useEffect(() => {
    const load = () => {
      getDecisions()
        .then((ds) => setPending(ds.filter((d) => d.status === "proposed")))
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
    }, 10000);
    return () => clearInterval(t);
  }, [threadId, thinking]);

  async function resolveInline(d: Decision, action: "approve" | "reject") {
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
          ? await approveDecision(d.id)
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
          className="mb-3 w-full rounded-lg border border-hairline px-3 py-2 text-sm font-medium text-ink-2 hover:bg-ink/[0.04] dark:hover:bg-white/5"
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
          className="rounded-lg border border-hairline px-3.5 py-2 text-sm font-medium text-ink-2 hover:bg-ink/[0.04] lg:hidden dark:hover:bg-white/5"
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
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-series-1 text-white"
                  : "border border-hairline bg-surface text-ink"
              }`}
            >
              {m.text}
            </div>
            <div className="mt-1 px-1 text-[11px] text-ink-muted">
              {m.role === "agent" ? "Analyst · " : ""}
              {dateTime(m.at)}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex items-center gap-1.5 rounded-2xl border border-hairline bg-surface px-4 py-3 text-sm text-ink-muted self-start">
            <span className="size-1.5 animate-pulse rounded-full bg-ink-muted" />
            <span className="size-1.5 animate-pulse rounded-full bg-ink-muted [animation-delay:150ms]" />
            <span className="size-1.5 animate-pulse rounded-full bg-ink-muted [animation-delay:300ms]" />
            <span className="ml-1">Reading the records…</span>
          </div>
        )}
      </div>

      {pending.length > 0 && (
        <div className="shrink-0 border-t border-hairline pt-3">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-ink-muted">
            <span>Trades awaiting your approval</span>
            <a href="/proposals" className="font-medium text-series-1 hover:underline">
              Full details & history →
            </a>
          </div>
          <div className="flex flex-col gap-2">
            {pending.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-hairline bg-surface px-3.5 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium">
                    {d.action === "buy" ? "Buy" : "Sell"} {d.qty} {d.symbol}
                    {d.estValue ? (
                      <span className="text-ink-muted"> · ~{usd(d.estValue)}</span>
                    ) : null}
                  </span>
                  <p className="line-clamp-1 text-xs text-ink-2">{d.rationale}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => resolveInline(d, "approve")}
                    className="rounded-lg bg-series-1 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => resolveInline(d, "reject")}
                    className="rounded-lg border border-hairline px-3 py-1.5 text-sm text-ink-2 hover:bg-ink/[0.04] dark:hover:bg-white/5"
                  >
                    Reject
                  </button>
                </div>
              </div>
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
            className="rounded-lg bg-series-1 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Send
          </button>
        </form>
        <p className="mt-2 text-xs text-ink-muted">
          Answers are grounded in the live paper account and the agent&apos;s
          recorded decisions. Simulated — not financial advice.{" "}
          <a href="/proposals" className="text-series-1 hover:underline">
            Research history & proposal details →
          </a>
        </p>
      </div>
      </div>
    </div>
  );
}
