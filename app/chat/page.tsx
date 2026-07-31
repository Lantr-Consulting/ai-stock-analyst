"use client";

import { useEffect, useState } from "react";
import { askAnalyst, getChatHistory, getThreads, isSignedOut, newThread, type Thread } from "@/lib/api";
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
  const toast = useToast();

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
      reply = isSignedOut(e)
        ? "You're not signed in — sign in (link in the sidebar) and I'll answer from your own account records."
        : OFFLINE_REPLY;
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
          recorded decisions. Simulated — not financial advice.
        </p>
      </div>
      </div>
    </div>
  );
}
