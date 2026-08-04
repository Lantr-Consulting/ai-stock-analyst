"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  createAutomation,
  deleteAutomation,
  getAutomations,
  getResearchRuns,
  isSignedOut,
  runAutomation,
  toggleAutomation,
  type Automation,
  type ResearchRun,
} from "@/lib/api";
import { Card } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { useToast } from "@/components/toast";

const CADENCES = [
  { v: "manual", label: "Manual — run when I click" },
  { v: "market_open", label: "Every market open (9:30am ET)" },
  { v: "daily", label: "Daily at a set hour" },
  { v: "weekly", label: "Weekly (Fridays)" },
];

const TEMPLATES = [
  {
    title: "Portfolio research",
    prompt:
      "Run a full research cycle: review my portfolio and open orders, scan my watchlist plus market movers, and propose the trades that best move me toward my strategy's target allocation.",
  },
  {
    title: "Daily market update",
    prompt:
      "Write me a concise daily market update: what moved in and around my portfolio and watchlist today and why, citing prices, indicators, and news. No trade proposals — report only.",
  },
  {
    title: "Weekly performance review",
    prompt:
      "Review my portfolio's performance this week: what helped, what hurt, how I'm tracking against my strategy, and one thing to watch next week. Report only.",
  },
];

export default function AutomationsPage() {
  const [autos, setAutos] = useState<Automation[] | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [cadence, setCadence] = useState("manual");
  const [hour, setHour] = useState(21);
  const [busy, setBusy] = useState(false);
  const [runs, setRuns] = useState<ResearchRun[]>([]);
  const toast = useToast();

  useEffect(() => {
    const load = () => {
      getAutomations()
        .then(setAutos)
        .catch((e) => setSignedOut(isSignedOut(e)));
      getResearchRuns().then(setRuns).catch(() => {});
    };
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !prompt.trim() || busy) return;
    setBusy(true);
    try {
      const a = await createAutomation({ title, prompt, cadence, hourUtc: hour });
      setAutos((prev) => [a, ...(prev ?? [])]);
      setTitle("");
      setPrompt("");
      toast("success", `Automation "${a.title}" created.`);
    } catch {
      toast("error", "Couldn't create the automation — try again.");
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Automations</h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          {signedOut ? (
            <>
              <Link href="/signin" className="font-medium text-series-1 hover:underline">
                Sign in
              </Link>{" "}
              to set up automations.
            </>
          ) : (
            "Give your analyst standing missions — research runs, market updates, reviews — on your schedule. Results arrive as conversations and proposals."
          )}
        </p>
      </header>

      {!signedOut && (
        <Card title="New automation">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {TEMPLATES.map((t) => (
              <button
                key={t.title}
                onClick={() => {
                  setTitle(t.title);
                  setPrompt(t.prompt);
                }}
                className="rounded-full border border-hairline px-3 py-1 text-xs text-ink-2 hover:bg-ink/[0.04] dark:hover:bg-white/5"
              >
                {t.title}
              </button>
            ))}
          </div>
          <form onSubmit={create} className="flex flex-col gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title — e.g. Daily market update"
              className="rounded-lg border border-hairline bg-page px-3.5 py-2.5 text-sm outline-none placeholder:text-ink-muted focus:border-series-1"
            />
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="The mission, in plain English — what should the analyst do on each run?"
              className="resize-none rounded-lg border border-hairline bg-page px-3.5 py-2.5 text-sm outline-none placeholder:text-ink-muted focus:border-series-1"
            />
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={cadence}
                onChange={(e) => setCadence(e.target.value)}
                className="rounded-lg border border-hairline bg-page px-3 py-2 text-sm outline-none"
              >
                {CADENCES.map((c) => (
                  <option key={c.v} value={c.v}>
                    {c.label}
                  </option>
                ))}
              </select>
              {(cadence === "daily" || cadence === "weekly") && (
                <label className="flex items-center gap-2 text-sm text-ink-2">
                  at
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={hour}
                    onChange={(e) => setHour(Number(e.target.value))}
                    className="w-16 rounded-lg border border-hairline bg-page px-2 py-1.5 text-sm outline-none"
                  />
                  :00 UTC
                </label>
              )}
              <button
                type="submit"
                disabled={busy}
                className="ml-auto btn-primary px-4 py-2 text-sm font-medium  disabled:opacity-50"
              >
                Create automation
              </button>
            </div>
          </form>
        </Card>
      )}

      {(autos ?? []).map((a) => {
        const mine = runs.filter((r) => r.automation_id === a.id);
        const running = mine.find((r) => r.status === "running");
        const latest = mine.find((r) => r.status !== "running");
        const past = mine.filter((r) => r.status !== "running").slice(1, 6);
        return (
        <Card key={a.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={`size-2 rounded-full ${a.enabled ? "bg-good" : "bg-baseline"}`}
                />
                <h3 className="text-base font-semibold tracking-tight">{a.title}</h3>
              </div>
              <p className="mt-1 text-sm text-ink-2">{a.prompt}</p>
              <p className="mt-1 text-xs text-ink-muted">
                {CADENCES.find((c) => c.v === a.cadence)?.label ?? a.cadence}
                {a.last_run_at ? ` · last ran ${dateTime(a.last_run_at)}` : " · never run"}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={async () => {
                  try {
                    await runAutomation(a.id);
                    toast("info", `"${a.title}" started — results arrive in chat and Proposals.`);
                  } catch (e) {
                    toast("error", e instanceof Error ? e.message : "Couldn't start the run.");
                  }
                }}
                className="btn-primary px-3.5 py-2 text-sm font-medium "
              >
                Run now
              </button>
              <button
                onClick={async () => {
                  const enabled = !a.enabled;
                  setAutos((prev) => (prev ?? []).map((x) => (x.id === a.id ? { ...x, enabled } : x)));
                  try {
                    await toggleAutomation(a.id, enabled);
                  } catch {
                    toast("error", "Couldn't update — try again.");
                  }
                }}
                className="btn-ghost px-3.5 py-2 text-sm font-medium  dark:hover:bg-white/5"
              >
                {a.enabled ? "Disable" : "Enable"}
              </button>
              <button
                onClick={async () => {
                  setAutos((prev) => (prev ?? []).filter((x) => x.id !== a.id));
                  try {
                    await deleteAutomation(a.id);
                    toast("info", `"${a.title}" deleted.`);
                  } catch {
                    toast("error", "Couldn't delete — refresh and try again.");
                  }
                }}
                className="rounded-lg border border-hairline px-3 py-2 text-sm text-ink-muted hover:text-critical"
              >
                ×
              </button>
            </div>
          </div>

          {running && (
            <div className="mt-4 rounded-xl bg-page px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <span aria-hidden className="size-2 animate-pulse rounded-full bg-accent" />
                <span className="font-medium">Running now…</span>
                <span className="text-xs text-ink-muted">
                  results appear here when it finishes
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-baseline">
                <div className="h-full w-2/5 animate-pulse rounded-full bg-accent" />
              </div>
            </div>
          )}

          {latest && (
            <div className="mt-4 rounded-xl bg-page px-4 py-3">
              <div className="mb-1.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                Latest result
                <span
                  aria-hidden
                  className={`size-1.5 rounded-full ${latest.status === "error" ? "bg-critical" : "bg-good"}`}
                />
                <span className="normal-case">{dateTime(latest.finished_at ?? latest.started_at)}</span>
              </div>
              {latest.status === "error" ? (
                <p className="text-sm text-critical">{latest.error ?? "Run failed."}</p>
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-2">
                  {latest.report ?? "No report recorded."}
                </p>
              )}
              {latest.decisions.filter((d) => d.symbol).length > 0 && (
                <a href="/proposals" className="mt-2 inline-block text-xs font-medium text-series-1 hover:underline">
                  {latest.decisions.filter((d) => d.symbol).length} trade
                  {latest.decisions.filter((d) => d.symbol).length > 1 ? "s" : ""} proposed — review →
                </a>
              )}
            </div>
          )}

          {past.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-ink-muted">
                Past runs — {past.length}
              </summary>
              <ul className="mt-2 flex flex-col gap-2">
                {past.map((r) => (
                  <li key={r.id} className="rounded-lg bg-page px-3 py-2">
                    <div className="text-[11px] text-ink-muted">
                      {dateTime(r.finished_at ?? r.started_at)}
                      {r.status === "error" ? " · failed" : ""}
                    </div>
                    <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-ink-2">
                      {r.status === "error" ? (r.error ?? "Run failed.") : (r.report ?? "—")}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>
        );
      })}

      {autos !== null && autos.length === 0 && !signedOut && (
        <p className="text-sm text-ink-muted">
          No automations yet — try a template above. "Portfolio research" on
          every market open is the classic always-on setup.
        </p>
      )}
    </div>
  );
}

