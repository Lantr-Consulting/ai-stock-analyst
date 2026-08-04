"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  activateAgent,
  getMe,
  interpretProfile,
  isSignedOut,
  updateSettings,
  type Me,
  type SafeguardSettings,
} from "@/lib/api";
import { Card } from "@/components/ui";
import { profile as sampleProfile, strategy as sampleStrategy } from "@/lib/mock";
import { useToast } from "@/components/toast";

type View = {
  profile: Me["profile"];
  strategy: Me["strategy"];
  profileVersion: number;
  strategyVersion: number;
  rawInstructions: string[];
};

const SAMPLE: View = {
  profile: sampleProfile,
  strategy: sampleStrategy,
  profileVersion: sampleProfile.version,
  strategyVersion: sampleStrategy.version,
  rawInstructions: sampleProfile.rawInstructions,
};

export default function SetupPage() {
  const [instructions, setInstructions] = useState("");
  const [view, setView] = useState<View | null>(null);
  const [status, setStatus] = useState<"live" | "signedOut" | "offline">("live");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [updated, setUpdated] = useState(false);
  const toast = useToast();

  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    getMe()
      .then((m) => {
        setMe(m);
        setView(m);
      })
      .catch((e) => {
        setStatus(isSignedOut(e) ? "signedOut" : "offline");
        setView(SAMPLE);
      });
  }, []);

  async function update() {
    const t = instructions.trim();
    if (!t) {
      setNote(
        "请先写下你的偏好，例如喜欢的行业或希望避开的公司。"
      );
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const result = await interpretProfile(t);
      setView(result);
      setInstructions("");
      setUpdated(true);
      setNote(
        "已保存。研究助手之后会按这套策略开展研究，请在下方确认它是否理解准确。"
      );
      toast("success", "投资偏好已更新，研究助手会采用新的策略。 ");
    } catch (e) {
      setNote(
        isSignedOut(e)
          ? "请先登录，投资偏好会保存到你的账户中。"
          : "暂时无法连接研究服务，请稍后再试。"
      );
    }
    setBusy(false);
  }

  const v = view ?? SAMPLE;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">投资偏好</h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          {status === "signedOut" ? (
            <>
              当前展示示例偏好。{" "}
              <Link href="/signin" className="font-medium text-series-1 hover:underline">
                登录
              </Link>{" "}
              后可设置你的研究助手
            </>
          ) : (
            "直接说清楚你的目标、风险承受能力和关注方向；助手会整理成投资偏好与研究策略，并在每轮研究中使用。"
          )}
        </p>
      </header>

      <Card title="告诉助手你在意什么">
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          placeholder="例如：我偏好大型科技公司，能承受中等风险，并认为 AI 基础设施还会持续增长。"
          className="w-full resize-none rounded-lg border border-hairline bg-page px-3.5 py-2.5 text-sm outline-none placeholder:text-ink-muted focus:border-series-1"
        />
        <div className="mt-3 flex items-center justify-end">
          <button
            onClick={update}
            disabled={busy || status === "signedOut"}
            className="btn-primary px-3.5 py-2 text-sm font-medium  disabled:opacity-50"
          >
            {busy ? "正在理解…" : "更新偏好"}
          </button>
        </div>
        {note && <p className="mt-2 text-xs text-ink-2">{note}</p>}
      </Card>

      {me && !me.activated && status === "live" && (
        <ActivateCard
          key={v.strategyVersion}
          universe={v.strategy.universe ?? []}
          safeguards={me.safeguards}
          ready={v.strategyVersion >= 1 && (v.strategy.universe?.length ?? 0) > 0}
          onActivated={() => setMe((m) => (m ? { ...m, activated: true } : m))}
        />
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title={`偏好摘要 · 版本 ${v.profileVersion}`}
          className={updated ? "ring-1 ring-series-1/40" : ""}
        >
          {!v.profile.goals ? (
            <p className="text-sm text-ink-2">
              这里还没有内容。请在上方描述你的投资方式，助手会根据你的原话整理偏好。
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm leading-relaxed">{v.profile.goals}</p>
              <div className="grid grid-cols-3 gap-2 max-sm:grid-cols-1">
                <ProfileStat
                  label="风险偏好"
                  value={
                    v.profile.riskTolerance
                      ? riskLabel(v.profile.riskTolerance)
                      : "—"
                  }
                  tone={
                    v.profile.riskTolerance === "aggressive"
                      ? "text-critical"
                      : v.profile.riskTolerance === "conservative"
                        ? "text-series-3"
                        : "text-warning"
                  }
                  meter={
                    v.profile.riskTolerance === "aggressive"
                      ? 3
                      : v.profile.riskTolerance === "conservative"
                        ? 1
                        : 2
                  }
                />
                <ProfileStat label="投资期限" value={v.profile.timeHorizon ?? "—"} />
                <ProfileStat label="交易频率" value={v.profile.tradingFrequency ?? "—"} />
              </div>
              {(v.profile.preferredSectors ?? []).length > 0 && (
                <div>
                  <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                    偏好方向
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(v.profile.preferredSectors ?? []).map((x) => (
                      <span key={x} className="rounded-full bg-series-1/15 px-2.5 py-1 text-xs font-medium text-series-1">
                        {x}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(v.profile.avoid ?? []).length > 0 && (
                <div>
                  <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                    主动规避
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(v.profile.avoid ?? []).map((x) => (
                      <span key={x} className="rounded-full bg-critical/15 px-2.5 py-1 text-xs font-medium text-critical">
                        {x}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {v.rawInstructions.length > 0 && (
            <div className="mt-4 border-t border-hairline pt-3">
              <div className="text-xs font-medium text-ink-muted">
                你的原始要求
              </div>
              <ul className="mt-2 flex flex-col gap-1.5">
                {v.rawInstructions.map((r) => (
                  <li key={r} className="text-sm text-ink-2">
                    &ldquo;{r}&rdquo;
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card
          title={`研究策略 · 版本 ${v.strategyVersion}`}
          className={updated ? "ring-1 ring-series-1/40" : ""}
        >
          <p className="text-sm leading-relaxed text-ink-2">
            {v.strategy.summary}
          </p>
          {v.strategy.watching?.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                重点关注
              </div>
              <ul className="flex flex-col gap-1.5">
                {v.strategy.watching.map((w) => (
                  <li key={w} className="flex items-start gap-2 text-sm text-ink-2">
                    <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-series-1" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
              执行规则
            </div>
            <ul className="flex flex-col gap-1.5">
              {v.strategy.rules.map((r) => (
                <li key={r} className="flex items-start gap-2 text-sm text-ink-2">
                  <span aria-hidden className="mt-0.5 font-bold text-accent">✓</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-4">
            <div className="text-xs font-medium text-ink-muted">
              研究范围
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {v.strategy.universe.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-hairline px-2.5 py-0.5 text-xs font-medium"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ActivateCard({
  universe: initialUniverse,
  safeguards,
  ready,
  onActivated,
}: {
  universe: string[];
  safeguards: SafeguardSettings;
  ready: boolean;
  onActivated: () => void;
}) {
  const toast = useToast();
  const [universe, setUniverse] = useState(initialUniverse);
  const [addSym, setAddSym] = useState("");
  const [sg, setSg] = useState({
    maxPositionPct: safeguards.maxPositionPct,
    minCashPct: safeguards.minCashPct,
    maxOrderPct: safeguards.maxOrderPct,
    maxTradesPerDay: safeguards.maxTradesPerDay,
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function activate() {
    setBusy(true);
    setErr(null);
    try {
      await updateSettings({ universe, safeguards: sg });
      await activateAgent();
      setDone(true);
      onActivated();
      toast("success", "研究助手已启用，可以开始第一轮研究了。 ");
    } catch (e) {
      setErr(e instanceof Error && e.message.includes("activate") ? "启用失败，请检查设置后重试。" : "暂时无法启用，请稍后再试。 ");
    }
    setBusy(false);
  }

  if (done) {
    return (
      <Card className="ring-1 ring-good/40">
        <p className="text-sm">
          <span className="font-medium text-delta-up dark:text-good">
            研究助手已启用。
          </span>{" "}
          <Link href="/proposals" className="font-medium text-series-1 hover:underline">
            开始第一轮研究 →
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card title="第二步 · 确认并启用" className="ring-1 ring-series-1/40">
      {!ready ? (
        <p className="text-sm text-ink-2">
          研究助手<span className="font-medium">尚未启用</span>。请先在上方描述你的投资方式，
          助手会整理出策略、研究范围和风控参数，供你确认。
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-2 text-xs font-medium text-ink-muted">
              初始研究范围：助手会优先研究这些标的，也会查看美股市场异动。
              你可以自由增删，也可以保留当前设置。
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {universe.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-full border border-hairline px-2.5 py-0.5 text-xs font-medium"
                >
                  {s}
                  <button
                    aria-label={`移除 ${s}`}
                    onClick={() => setUniverse((u) => u.filter((x) => x !== s))}
                    className="text-ink-muted hover:text-critical"
                  >
                    ×
                  </button>
                </span>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const s = addSym.trim().toUpperCase();
                  if (s && !universe.includes(s)) setUniverse((u) => [...u, s]);
                  setAddSym("");
                }}
                className="inline-flex"
              >
                <input
                  value={addSym}
                  onChange={(e) => setAddSym(e.target.value)}
                  placeholder="+ 添加代码"
                  className="w-28 rounded-full border border-dashed border-hairline bg-transparent px-2.5 py-0.5 text-xs outline-none placeholder:text-ink-muted focus:border-series-1"
                />
              </form>
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-medium text-ink-muted">
              风控限制：每笔模拟订单都会由代码强制检查，具体数值由你设定。
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumField label="单一标的上限 %" value={sg.maxPositionPct} onChange={(v) => setSg((s) => ({ ...s, maxPositionPct: v }))} />
              <NumField label="最低现金 %" value={sg.minCashPct} onChange={(v) => setSg((s) => ({ ...s, minCashPct: v }))} />
              <NumField label="单笔订单上限 %" value={sg.maxOrderPct} onChange={(v) => setSg((s) => ({ ...s, maxOrderPct: v }))} />
              <NumField label="每日最多交易" value={sg.maxTradesPerDay} onChange={(v) => setSg((s) => ({ ...s, maxTradesPerDay: v }))} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-ink-muted">
              启用前不会运行任何研究；之后也可以随时在“设置与风控”中修改。
            </p>
            <button
              onClick={activate}
              disabled={busy || universe.length === 0}
              className="shrink-0 btn-primary px-4 py-2 text-sm font-medium  disabled:opacity-50"
            >
              {busy ? "正在启用…" : "启用研究助手"}
            </button>
          </div>
          {err && <p className="text-xs text-critical">{err}</p>}
        </div>
      )}
    </Card>
  );
}

function riskLabel(value: string) {
  return {
    conservative: "保守",
    moderate: "稳健",
    aggressive: "积极",
  }[value] ?? value;
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-ink-muted">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-lg border border-hairline bg-page px-3 py-2 text-sm outline-none focus:border-series-1"
        style={{ fontVariantNumeric: "tabular-nums" }}
      />
    </label>
  );
}

function ProfileStat({
  label,
  value,
  tone,
  meter,
}: {
  label: string;
  value: string;
  tone?: string;
  meter?: number;
}) {
  return (
    <div className="rounded-xl bg-page px-3.5 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </div>
      <div className={`mt-0.5 truncate text-sm font-semibold ${tone ?? ""}`}>{value}</div>
      {meter !== undefined && (
        <div className="mt-1.5 flex gap-1">
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= meter ? "bg-accent" : "bg-baseline"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

