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
  { v: "manual", label: "手动运行" },
  { v: "market_open", label: "每个美股交易日开盘（美东 9:30）" },
  { v: "daily", label: "每天定时" },
  { v: "weekly", label: "每周五" },
];

const TEMPLATES = [
  {
    title: "组合研究",
    prompt:
      "完成一轮组合研究：复盘我的持仓和未成交订单，查看自选股与市场异动，并仅在证据充分时提出符合目标配置的交易建议。",
  },
  {
    title: "每日市场简报",
    prompt:
      "写一份简洁的每日市场简报：说明持仓和自选股今天有哪些变化、为什么变化，并附上价格、技术指标和新闻依据。只做汇报，不提出交易建议。",
  },
  {
    title: "每周表现复盘",
    prompt:
      "复盘本周组合表现：哪些持仓带来收益、哪些拖累表现、当前与策略目标有何偏差，以及下周最值得关注的一件事。只做汇报。",
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
      toast("success", `定时任务“${a.title}”已创建。`);
    } catch {
      toast("error", "暂时无法创建任务，请稍后再试。");
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">定时任务</h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          {signedOut ? (
            <>
              <Link href="/signin" className="font-medium text-series-1 hover:underline">
                登录
              </Link>{" "}
              后可设置定时任务。
            </>
          ) : (
            "把组合研究、市场简报和定期复盘交给研究助手按时完成；结果会同步到对话和交易建议中。"
          )}
        </p>
      </header>

      {!signedOut && (
        <Card title="新建任务">
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
              placeholder="任务名称，例如：每日市场简报"
              className="rounded-lg border border-hairline bg-page px-3.5 py-2.5 text-sm outline-none placeholder:text-ink-muted focus:border-series-1"
            />
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="用自然语言说明每次运行时，希望研究助手完成什么"
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
                  于
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
                创建任务
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
                {a.last_run_at ? ` · 上次运行 ${dateTime(a.last_run_at)}` : " · 尚未运行"}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={async () => {
                  try {
                    await runAutomation(a.id);
                    toast("info", `“${a.title}”已开始，结果会出现在对话和研究助手中。`);
                  } catch (e) {
                    toast("error", e instanceof Error ? e.message : "暂时无法开始运行。 ");
                  }
                }}
                className="btn-primary px-3.5 py-2 text-sm font-medium "
              >
                立即运行
              </button>
              <button
                onClick={async () => {
                  const enabled = !a.enabled;
                  setAutos((prev) => (prev ?? []).map((x) => (x.id === a.id ? { ...x, enabled } : x)));
                  try {
                    await toggleAutomation(a.id, enabled);
                  } catch {
                    toast("error", "暂时无法更新，请稍后再试。");
                  }
                }}
                className="btn-ghost px-3.5 py-2 text-sm font-medium  dark:hover:bg-white/5"
              >
                {a.enabled ? "停用" : "启用"}
              </button>
              <button
                onClick={async () => {
                  setAutos((prev) => (prev ?? []).filter((x) => x.id !== a.id));
                  try {
                    await deleteAutomation(a.id);
                    toast("info", `“${a.title}”已删除。`);
                  } catch {
                    toast("error", "暂时无法删除，请刷新后重试。");
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
                <span className="font-medium">正在运行…</span>
                <span className="text-xs text-ink-muted">
                  完成后会在这里显示结果
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
                最近一次结果
                <span
                  aria-hidden
                  className={`size-1.5 rounded-full ${latest.status === "error" ? "bg-critical" : "bg-good"}`}
                />
                <span className="normal-case">{dateTime(latest.finished_at ?? latest.started_at)}</span>
              </div>
              {latest.status === "error" ? (
                <p className="text-sm text-critical">{latest.error ?? "本次运行失败。"}</p>
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-2">
                  {latest.report ?? "本次运行没有生成报告。"}
                </p>
              )}
              {latest.decisions.filter((d) => d.symbol).length > 0 && (
                <a href="/proposals" className="mt-2 inline-block text-xs font-medium text-series-1 hover:underline">
                  已生成 {latest.decisions.filter((d) => d.symbol).length} 笔交易建议，前往确认 →
                </a>
              )}
            </div>
          )}

          {past.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-ink-muted">
                过往运行 · {past.length} 次
              </summary>
              <ul className="mt-2 flex flex-col gap-2">
                {past.map((r) => (
                  <li key={r.id} className="rounded-lg bg-page px-3 py-2">
                    <div className="text-[11px] text-ink-muted">
                      {dateTime(r.finished_at ?? r.started_at)}
                      {r.status === "error" ? " · 失败" : ""}
                    </div>
                    <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-ink-2">
                      {r.status === "error" ? (r.error ?? "本次运行失败。") : (r.report ?? "—")}
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
          还没有定时任务。可以先用上方模板创建一个“组合研究”，在每个美股交易日开盘时运行。
        </p>
      )}
    </div>
  );
}

