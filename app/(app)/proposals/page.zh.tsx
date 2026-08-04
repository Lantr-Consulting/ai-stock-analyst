"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  approveDecision,
  getDecisions,
  getResearchRuns,
  isSignedOut,
  rejectDecision,
  runResearchCycle,
  steerRun,
  type ResearchRun,
} from "@/lib/api";
import { Card, SafeguardList, StatusBadge } from "@/components/ui";
import { dateTime, usd } from "@/lib/format";
import { decisions as mockDecisions } from "@/lib/mock";
import { useToast } from "@/components/toast";
import type { Decision, DecisionStatus } from "@/lib/types";

export default function ProposalsPage() {
  const [decisions, setDecisions] = useState<Decision[] | null>(null);
  const [status, setStatus] = useState<"live" | "signedOut" | "offline">("live");
  const [researching, setResearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [runs, setRuns] = useState<ResearchRun[]>([]);
  const toast = useToast();
  const [steerText, setSteerText] = useState("");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | DecisionStatus>("all");
  const offline = status !== "live";
  const activeRun = runs.find((r) => r.status === "running");

  useEffect(() => {
    if (!activeRun) return;
    const t = setInterval(() => {
      getResearchRuns()
        .then((rs) => {
          setRuns(rs);
          const done = rs.find((r) => r.id === activeRun.id && r.status !== "running");
          if (done) {
            getDecisions().then(setDecisions).catch(() => {});
            setResearching(false);
            setNote(
              done.status === "error"
                ? `本轮研究失败：${done.error ?? "未知错误"}`
                : "研究已完成，结论和交易建议如下。"
            );
            toast(
              done.status === "error" ? "error" : "success",
              done.status === "error"
                ? "本轮研究失败，请查看页面中的详细信息。"
                : "研究已完成，新的交易建议可以查看了。"
            );
          }
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [activeRun?.id, activeRun]);

  useEffect(() => {
    const load = () => {
      getResearchRuns().then(setRuns).catch(() => {});
      return getDecisions()
        .then(setDecisions)
        .catch((e) => {
          setStatus(isSignedOut(e) ? "signedOut" : "offline");
          setDecisions((prev) => prev ?? mockDecisions);
        });
    };
    load();
    const onFocus = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  async function research() {
    setResearching(true);
    setNote(null);
    try {
      await runResearchCycle();
      const rs = await getResearchRuns();
      setRuns(rs);
      setNote("研究已经开始；即使离开这个页面，任务也会继续运行。 ");
      toast("info", "研究已经开始，助手正在读取市场数据。 ");
    } catch (e) {
      setResearching(false);
      setNote(
        e instanceof Error && e.message.includes("activate")
          ? "请先完成投资偏好设置并启用研究助手。"
          : e instanceof Error && e.message.includes("already running")
            ? "已有一轮研究正在运行，完成后会自动显示结果。"
            : "暂时无法开始研究，请稍后再试。"
      );
    }
  }

  async function resolve(id: string, action: "approve" | "reject", reason?: string, qty?: number) {
    setBusyId(id);
    const before = decisions;
    // Optimistic: reflect the action instantly, reconcile with the server after.
    setDecisions((prev) =>
      (prev ?? []).map((d) =>
        d.id === id
          ? { ...d, status: action === "approve" ? "approved" : "rejected", feedback: reason ?? d.feedback }
          : d
      )
    );
    toast(
      "info",
      action === "approve"
        ? "已确认，正在向模拟账户提交订单…"
        : "已拒绝，研究助手会在之后的研究中参考这个反馈。"
    );
    try {
      const updated =
        action === "approve"
          ? await approveDecision(id, qty)
          : await rejectDecision(id, reason);
      setDecisions((prev) =>
        (prev ?? []).map((d) => (d.id === id ? updated : d))
      );
      if (action === "approve") {
        toast(
          updated.status === "blocked" ? "error" : "success",
          updated.status === "filled"
            ? `模拟订单已成交${updated.order?.fillPrice ? `，成交价 $${updated.order.fillPrice}` : ""}。`
            : updated.status === "blocked"
              ? "订单已被风控拦截：确认时的市场条件与建议生成时不同，请查看检查结果。"
              : "模拟订单已被 Alpaca 接收，将在美股开盘后撮合。"
        );
      }
    } catch {
      setDecisions(before);
      toast("error", `${action === "approve" ? "确认" : "拒绝"}失败，请检查连接后重试。`);
    }
    setBusyId(null);
  }

  const all = (decisions ?? []).filter(
    (d) => !selectedRunId || d.runId === selectedRunId
  );
  const shown = filter === "all" ? all : all.filter((d) => d.status === filter);
  const pending = shown.filter((d) => d.status === "proposed");
  const resolved = shown.filter((d) => d.status !== "proposed");
  const FILTERS: { v: "all" | DecisionStatus; label: string }[] = [
    { v: "all", label: "全部" },
    { v: "proposed", label: "待确认" },
    { v: "approved", label: "已确认" },
    { v: "filled", label: "已成交" },
    { v: "blocked", label: "已拦截" },
    { v: "rejected", label: "已拒绝" },
  ];

  return (
    <div className="flex flex-1 gap-6">
      {runs.length > 0 && (
        <aside className="order-last w-56 shrink-0 self-start sticky top-0 max-h-[85vh] overflow-y-auto max-lg:hidden">
          <div className="mb-1 px-1 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            研究记录
          </div>
          <nav className="flex flex-col gap-0.5">
            <button
              onClick={() => setSelectedRunId(null)}
              className={`rounded-lg px-3 py-2 text-left text-sm ${
                !selectedRunId
                  ? "bg-ink/[0.06] font-medium text-ink dark:bg-white/10"
                  : "text-ink-2 hover:bg-ink/[0.04] dark:hover:bg-white/5"
              }`}
            >
              全部建议
            </button>
            {runs.slice(0, 15).map((r) => {
              const orders = r.decisions.filter((d) => d.symbol);
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedRunId(r.id)}
                  className={`rounded-lg px-3 py-2 text-left ${
                    selectedRunId === r.id
                      ? "bg-ink/[0.06] dark:bg-white/10"
                      : "hover:bg-ink/[0.04] dark:hover:bg-white/5"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-sm">
                    <span
                      aria-hidden
                      className={`size-1.5 shrink-0 rounded-full ${
                        r.status === "running"
                          ? "animate-pulse bg-series-1"
                          : r.status === "error"
                            ? "bg-critical"
                            : "bg-good"
                      }`}
                    />
                    <span className={selectedRunId === r.id ? "font-medium" : "text-ink-2"}>
                      {r.status === "running"
                        ? "研究中…"
                        : r.status === "error"
                          ? "运行失败"
                          : orders.length > 0
                            ? orders.map((o) => o.symbol).join(", ")
                            : "继续持有"}
                    </span>
                  </span>
                  <span className="block pl-3 text-[11px] text-ink-muted">
                    {dateTime(r.started_at)}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            研究助手
          </h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            {status === "signedOut" ? (
              <>
                当前展示演示数据。{" "}
                <Link href="/signin" className="font-medium text-series-1 hover:underline">
                  登录
                </Link>{" "}
                后可运行你的研究助手
              </>
            ) : status === "offline" ? (
              "暂时无法连接服务，当前展示演示数据"
            ) : (
              "每条建议都会列出依据与风控检查；未经你确认，不会向模拟账户提交任何订单。"
            )}
          </p>
        </div>
        {!offline && (
          <button
            onClick={research}
            disabled={researching}
            className="btn-primary px-3.5 py-2 text-sm font-medium  disabled:opacity-50"
          >
            {researching ? "研究中…（约 30 秒）" : "开始一轮研究"}
          </button>
        )}
      </header>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const count =
            f.v === "all" ? all.length : all.filter((d) => d.status === f.v).length;
          if (f.v !== "all" && count === 0) return null;
          return (
            <button
              key={f.v}
              onClick={() => setFilter(f.v)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f.v
                  ? "bg-accent text-black"
                  : "bg-surface text-ink-2 hover:bg-white/10"
              }`}
            >
              {f.label}
              <span className={filter === f.v ? "ml-1.5 opacity-60" : "ml-1.5 text-ink-muted"}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {note && <p className="text-sm text-ink-2">{note}</p>}

      {activeRun && (
        <Card className="ring-1 ring-series-1/40">
          <div className="flex items-center gap-2 text-sm">
            <span className="size-2 animate-pulse rounded-full bg-series-1" />
            <span className="font-medium">正在研究</span>
            <span className="text-ink-muted">
              开始于 {dateTime(activeRun.started_at)}，正在读取价格、新闻、异动和技术指标…
            </span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-baseline">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear"
              style={{
                width: `${Math.max(4, Math.min(95, Math.round(((Date.now() - new Date(activeRun.started_at).getTime()) / 1000 / 90) * 100)))}%`,
              }}
            />
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!steerText.trim()) return;
              try {
                const r = await steerRun(activeRun.id, steerText.trim());
                toast("success", r.note);
                setSteerText("");
              } catch {
                setNote("暂时无法补充要求，请稍后再试。 ");
              }
            }}
            className="mt-3 flex gap-2"
          >
            <input
              value={steerText}
              onChange={(e) => setSteerText(e.target.value)}
              placeholder="补充本轮要求，例如：今天重点关注小市值 AI 公司"
              className="flex-1 rounded-lg border border-hairline bg-page px-3.5 py-2 text-sm outline-none placeholder:text-ink-muted focus:border-series-1"
            />
            <button
              type="submit"
              className="btn-ghost px-3.5 py-2 text-sm font-medium  dark:hover:bg-white/5"
            >
              提交补充
            </button>
          </form>
        </Card>
      )}
      {decisions === null && !offline && (
        <div className="h-40 animate-pulse rounded-xl bg-ink/5 dark:bg-white/10" />
      )}

      {decisions !== null && filter === "all" && pending.length === 0 && (
        <Card>
          <p className="text-sm text-ink-2">
            目前没有待确认的交易。开始一轮研究后，助手会读取实时价格和新闻；
            只有证据充分且通过风控时，才会提出交易建议。
          </p>
        </Card>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {pending.map((d) => (
          <ProposalCard
            key={d.id}
            decision={d}
            busy={busyId === d.id}
            onResolve={offline ? undefined : (a, r, q) => resolve(d.id, a, r, q)}
          />
        ))}
      </div>

      {resolved.length > 0 && filter === "all" && (
        <h2 className="mt-2 text-sm font-semibold text-ink-muted">
          最近处理
        </h2>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {resolved.slice(0, 8).map((d) => (
          <ProposalCard key={d.id} decision={d} busy={false} />
        ))}
      </div>

      {runs.length > 0 && (
        <>
          <h2 className="mt-2 text-sm font-semibold text-ink-muted">
            研究历史
          </h2>
          <Card>
            <ol className="flex flex-col gap-3">
              {runs.slice(0, 10).map((r) => {
                const orders = r.decisions.filter((d) => d.symbol);
                const plan = r.decisions.find((d) => !d.symbol);
                return (
                  <li key={r.id} className="flex flex-col gap-1 border-b border-hairline pb-3 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span
                        aria-hidden
                        className={`size-2 rounded-full ${
                          r.status === "running"
                            ? "animate-pulse bg-series-1"
                            : r.status === "error"
                              ? "bg-critical"
                              : "bg-good"
                        }`}
                      />
                      <span className="font-medium">
                        {r.status === "running"
                          ? "研究中…"
                          : r.status === "error"
                            ? "运行失败"
                            : `提出 ${orders.length} 笔交易建议`}
                      </span>
                      <span className="text-xs text-ink-muted">
                        {dateTime(r.started_at)}
                        {orders.length > 0 &&
                          ` · ${orders.map((o) => `${o.action === "sell" ? "卖出" : "买入"} ${o.symbol}`).join("、")}`}
                      </span>
                    </div>
                    {plan?.rationale && (
                      <p className="line-clamp-2 pl-4 text-xs text-ink-2">{plan.rationale}</p>
                    )}
                    {r.steer.length > 0 && (
                      <p className="pl-4 text-xs text-ink-muted">
                        追加要求：{r.steer.join(" · ")}
                      </p>
                    )}
                    {r.error && (
                      <p className="pl-4 text-xs text-critical">{r.error}</p>
                    )}
                  </li>
                );
              })}
            </ol>
          </Card>
        </>
      )}
      </div>
    </div>
  );
}

function ProposalCard({
  decision: d,
  busy,
  onResolve,
}: {
  decision: Decision;
  busy: boolean;
  onResolve?: (action: "approve" | "reject", reason?: string, qty?: number) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const proposedQty = Math.max(1, Math.round(d.qty ?? 1));
  const [qty, setQty] = useState(proposedQty);
  const isPending = d.status === "proposed" && !!onResolve;
  const price = d.order?.fillPrice ?? (d.estValue && d.qty ? d.estValue / d.qty : 0);
  const est = (isPending ? qty : (d.qty ?? 0)) * price;
  const passed = d.safeguards.filter((c) => c.status === "pass").length;

  if (!d.symbol) {
    return (
      <Card className="!p-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-surface-2 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <h3 className="text-lg font-bold tracking-tight">
              {d.action === "rebalance" ? "组合调整方案" : "继续持有，不操作"}
            </h3>
            <StatusBadge status={d.status} />
          </div>
          <span className="text-xs text-ink-muted">{dateTime(d.createdAt)}</span>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm leading-relaxed text-ink-2">{d.rationale}</p>
          {d.evidence.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-ink-muted">
                研究依据 · {d.evidence.length} 条
              </summary>
              <ul className="mt-2 flex flex-col gap-2">
                {d.evidence.map((e, i) => (
                  <li key={i} className="rounded-lg bg-page px-3 py-2 text-sm">
                    <div className="break-all text-xs text-ink-muted">
                      {e.source} · {dateTime(e.timestamp)}
                    </div>
                    <div className="mt-0.5 break-all text-ink-2">{e.summary}</div>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="border-b border-hairline bg-surface-2 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold tracking-tight">
            {d.action === "sell" ? "卖出" : "买入"} {d.symbol}
          </h3>
          <StatusBadge status={d.status} />
        </div>
        {d.rationale && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-2">
            {d.rationale}
          </p>
        )}
        <p className="mt-1 text-[11px] text-ink-muted">
          {dateTime(d.createdAt)} · 策略版本 {d.strategyVersion}
        </p>
      </div>

      <div className="flex flex-col gap-3 px-5 py-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">订单类型</span>
          <span className="text-ink-2">市价单 · 由研究助手建议</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">股数</span>
          {isPending ? (
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
              className="w-24 rounded-lg border border-hairline bg-page px-3 py-1.5 text-right text-sm outline-none focus:border-accent"
              style={{ fontVariantNumeric: "tabular-nums" }}
            />
          ) : (
            <span className="font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
              {d.qty}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-series-1">
            {d.order?.fillPrice ? "成交价" : "参考市价"}
          </span>
          <span className="font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
            {price ? usd(price) : "—"}
          </span>
        </div>
        <div className="border-t border-hairline pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">
              {d.order?.fillPrice ? "成交金额" : "预计金额"}
            </span>
            <span className="text-sm font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
              {usd(est)}
            </span>
          </div>
          {isPending && qty !== proposedQty && (
            <p className="mt-1 text-right text-[11px] text-ink-muted">
              已从 {proposedQty} 股调整为 {qty} 股，风控会按新数量重新检查
            </p>
          )}
        </div>

        {d.order && (
          <div className="rounded-lg bg-page px-3 py-2 text-xs text-ink-2">
            模拟订单 {d.order.id.slice(0, 8)} · {orderStatus(d.order.status)}
            {d.order.status === "accepted" && " · 将在下次美股开盘时撮合"}
          </div>
        )}

        {isPending && !rejecting && (
          <div className="flex gap-2">
            <button
              onClick={() => onResolve!("approve", undefined, qty)}
              disabled={busy}
              className="btn-primary flex-1 px-4 py-3 text-sm"
            >
              {busy ? "正在提交…" : "确认模拟订单"}
            </button>
            <button
              onClick={() => setRejecting(true)}
              disabled={busy}
              className="btn-ghost px-4 py-3 text-sm"
            >
              拒绝
            </button>
          </div>
        )}
        {isPending && rejecting && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onResolve!("reject", reason.trim() || undefined);
            }}
            className="flex gap-2"
          >
            <input
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="可选：说明原因，帮助助手改进后续研究"
              className="flex-1 rounded-lg border border-hairline bg-page px-3.5 py-2 text-sm outline-none placeholder:text-ink-muted focus:border-accent"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-critical px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "正在拒绝…" : "确认拒绝"}
            </button>
          </form>
        )}

        {d.status === "rejected" && d.feedback && (
          <p className="rounded-lg bg-critical/10 px-3 py-2 text-xs text-ink-2">
            <span className="font-medium">你的原因：</span> {d.feedback}
          </p>
        )}

        {d.evidence.length > 0 && (
          <details>
            <summary className="cursor-pointer text-xs font-medium text-ink-muted">
              研究依据 · {d.evidence.length} 条
            </summary>
            <ul className="mt-2 flex flex-col gap-2">
              {d.evidence.map((e, i) => (
                <li key={i} className="rounded-lg bg-page px-3 py-2 text-sm">
                  <div className="break-all text-xs text-ink-muted">
                    {e.source} · {dateTime(e.timestamp)}
                  </div>
                  <div className="mt-0.5 break-all text-ink-2">{e.summary}</div>
                </li>
              ))}
            </ul>
          </details>
        )}
        {d.safeguards.length > 0 && (
          <details>
            <summary className="cursor-pointer text-xs font-medium text-ink-muted">
              风控检查 · {passed}/{d.safeguards.length} 项通过
            </summary>
            <div className="mt-2">
              <SafeguardList checks={d.safeguards} />
            </div>
          </details>
        )}
      </div>
    </Card>
  );
}

function orderStatus(status: string) {
  return {
    accepted: "已接收",
    filled: "已成交",
    canceled: "已取消",
    rejected: "已拒绝",
    pending: "处理中",
  }[status] ?? status;
}

