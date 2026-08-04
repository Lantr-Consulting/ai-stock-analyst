"use client";

import { useEffect, useState } from "react";
import { getMe, updateSettings } from "@/lib/api";
import { Card } from "@/components/ui";
import { safeguards as initial } from "@/lib/mock";
import { useToast } from "@/components/toast";

function BrokerageCard() {
  return (
    <Card title="模拟账户">
      <p className="text-sm leading-relaxed text-ink-2">
        本项目接入 Alpaca Paper Trading，仅用于展示美股研究与模拟交易流程，不涉及真实资金。
        公开演示不收集个人券商密钥；所有模拟订单都必须由用户逐笔确认。
      </p>
    </Card>
  );
}

export default function SettingsPage() {
  const [sg, setSg] = useState(initial);
  const [live, setLive] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    getMe()
      .then((me) => {
        setSg({
          approvedUniverse: me.strategy.universe ?? [],
          maxPositionPct: me.safeguards.maxPositionPct,
          minCashPct: me.safeguards.minCashPct,
          maxOrderPct: me.safeguards.maxOrderPct,
          maxTradesPerDay: me.safeguards.maxTradesPerDay,
          approvalMode:
            me.safeguards.approvalMode === "autonomous_within_limits"
              ? "autonomous_within_limits"
              : "approve_each",
          paused: me.paused,
        });
        setLive(true);
      })
      .catch(() => {});
  }, []);

  async function persist(fields: {
    safeguards?: Record<string, number | string>;
    universe?: string[];
    paused?: boolean;
  }) {
    if (!live) return;
    setSaving(true);
    setSaveNote(null);
    try {
      await updateSettings(fields);
      setSaveNote("已保存，风控引擎会按新数值执行检查。");
      toast("success", fields.paused !== undefined
        ? fields.paused ? "研究助手已暂停，不会发起新的研究。" : "研究助手已恢复。"
        : "风控设置已保存，之后的每笔建议都会重新检查。 ");
    } catch {
      setSaveNote("暂时无法保存，请登录后重试。");
      toast("error", "暂时无法保存设置，请登录后重试。");
    }
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">
          设置与风控
        </h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          以下限制由独立风控引擎执行，不受模型控制；每笔模拟订单都必须通过全部检查。
        </p>
      </header>

      <BrokerageCard />

      <Card title="研究助手状态">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium">
              {sg.paused ? "已暂停" : "运行中"}
            </div>
            <p className="mt-0.5 text-sm text-ink-2">
              {sg.paused
                ? "研究助手已停止，不会运行新的研究；待确认建议仍会保留。"
                : "研究助手可以运行研究，并在风控范围内提出模拟交易建议。"}
            </p>
          </div>
          <button
            onClick={() => {
              const paused = !sg.paused;
              setSg((s) => ({ ...s, paused }));
              persist({ paused });
            }}
            className={`shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium ${
              sg.paused
                ? "bg-series-1 text-white hover:opacity-90"
                : "bg-critical text-white hover:opacity-90"
            }`}
          >
            {sg.paused ? "恢复运行" : "立即暂停"}
          </button>
        </div>
      </Card>

      <Card title="确认方式">
        <div className="rounded-lg border border-series-1 bg-series-1/5 px-4 py-3">
          <div className="text-sm font-medium">逐笔人工确认</div>
          <p className="mt-1 text-sm text-ink-2">
            研究助手只能提出建议。每笔模拟订单在提交前都要由你明确确认，系统不会自动交易。
          </p>
        </div>
      </Card>

      <Card title="风控限制">
        <div className="grid gap-4 sm:grid-cols-2">
          <Limit
            label="单一标的仓位上限"
            value={sg.maxPositionPct}
            suffix="% 组合资产"
            hint="买入后若超过此比例，订单会被拦截。"
            onChange={(v) => setSg((s) => ({ ...s, maxPositionPct: v }))}
          />
          <Limit
            label="最低现金比例"
            value={sg.minCashPct}
            suffix="% 组合资产"
            hint="买入后现金不能低于此比例。"
            onChange={(v) => setSg((s) => ({ ...s, minCashPct: v }))}
          />
          <Limit
            label="单笔订单上限"
            value={sg.maxOrderPct}
            suffix="% 组合资产"
            hint="任何一笔订单都不能超过组合总资产的这个比例。"
            onChange={(v) => setSg((s) => ({ ...s, maxOrderPct: v }))}
          />
          <Limit
            label="每日交易上限"
            value={sg.maxTradesPerDay}
            suffix="笔"
            hint="达到上限后，新的交易建议要等到下一个交易日。"
            onChange={(v) => setSg((s) => ({ ...s, maxTradesPerDay: v }))}
          />
        </div>
        {live && (
          <div className="mt-4 flex items-center justify-end gap-3">
            {saveNote && <span className="text-xs text-ink-2">{saveNote}</span>}
            <button
              onClick={() =>
                persist({
                  safeguards: {
                    maxPositionPct: sg.maxPositionPct,
                    minCashPct: sg.minCashPct,
                    maxOrderPct: sg.maxOrderPct,
                    maxTradesPerDay: sg.maxTradesPerDay,
                  },
                })
              }
              disabled={saving}
              className="btn-primary px-3.5 py-2 text-sm font-medium  disabled:opacity-50"
            >
              {saving ? "正在保存…" : "保存限制"}
            </button>
          </div>
        )}
      </Card>

      <Card title="研究范围">
        <p className="mb-3 text-sm text-ink-2">
          研究助手会优先查看这些标的，也会关注美股市场异动。系统会自动排除未知代码、
          场外交易标的和股价低于 3 美元的股票。可在“投资偏好”中修改范围。
        </p>
        <div className="flex flex-wrap gap-1.5">
          {sg.approvedUniverse.map((s) => (
            <span
              key={s}
              className="rounded-full border border-hairline px-2.5 py-0.5 text-xs font-medium"
            >
              {s}
            </span>
          ))}
        </div>
      </Card>

      <p className="text-xs text-ink-muted">
        {live
          ? "以上为已保存的风控设置，每笔交易建议都会按这些规则检查。"
          : "当前为演示参数，登录后可配置自己的风控设置。"}
      </p>
    </div>
  );
}

function Limit({
  label,
  value,
  suffix,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  hint: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          min={0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-24 rounded-lg border border-hairline bg-page px-3 py-2 text-sm outline-none focus:border-series-1"
          style={{ fontVariantNumeric: "tabular-nums" }}
        />
        <span className="text-sm text-ink-muted">{suffix}</span>
      </span>
      <span className="text-xs text-ink-muted">{hint}</span>
    </label>
  );
}

