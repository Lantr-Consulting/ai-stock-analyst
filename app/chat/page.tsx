"use client";

import { useState } from "react";
import { dateTime } from "@/lib/format";
import { cannedReply, chatThread } from "@/lib/mock";
import type { ChatMessage } from "@/lib/types";

const SUGGESTED = [
  "What are you watching right now?",
  "Why are you holding cash?",
  "How did my preferences affect the last trade?",
  "What have you done this week?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(chatThread);
  const [draft, setDraft] = useState("");

  function send(text: string) {
    const t = text.trim();
    if (!t) return;
    const now = new Date().toISOString();
    setMessages((m) => [
      ...m,
      { id: `u-${m.length}`, role: "user", text: t, at: now },
      { id: `a-${m.length}`, role: "agent", text: cannedReply, at: now },
    ]);
    setDraft("");
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
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
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
      </div>

      <div className="mt-auto">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {SUGGESTED.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-hairline bg-surface px-3 py-1 text-xs text-ink-2 hover:bg-ink/[0.04] dark:hover:bg-white/5"
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
            className="rounded-lg bg-series-1 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Send
          </button>
        </form>
        <p className="mt-2 text-xs text-ink-muted">
          Sample conversation — live answers arrive with the backend in
          Milestone 3.
        </p>
      </div>
    </div>
  );
}
