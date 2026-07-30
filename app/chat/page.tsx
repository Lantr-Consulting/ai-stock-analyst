"use client";

import { useState } from "react";
import { askAnalyst } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { chatThread } from "@/lib/mock";
import type { ChatMessage } from "@/lib/types";

const SUGGESTED = [
  "What are you watching right now?",
  "Why are you holding cash?",
  "How did my preferences affect the last trade?",
  "What have you done this week?",
];

const OFFLINE_REPLY =
  "I can't reach my backend right now, so I can't answer from my decision records. Start the backend (backend/ on port 8000) or check NEXT_PUBLIC_API_URL, then ask me again.";

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(chatThread);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);

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
      reply = await askAnalyst(thread);
    } catch {
      reply = OFFLINE_REPLY;
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
    <div className="flex flex-1 flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">
          Ask the analyst
        </h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          Interrogate any decision. The agent answers from its recorded
          evidence and safeguard results — never from a made-up explanation.
        </p>
      </header>

      <div className="flex flex-col gap-4">
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

      <div className="mt-auto">
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
          Answers are grounded in the sample account records; your live records
          arrive with the database in Milestone 5.
        </p>
      </div>
    </div>
  );
}
