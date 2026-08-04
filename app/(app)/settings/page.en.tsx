"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMe, isSignedOut, setAlpacaKeys, updateSettings } from "@/lib/api";
import { Card } from "@/components/ui";
import { safeguards as initial } from "@/lib/mock";
import { useToast } from "@/components/toast";

function BrokerageCard() {
  const [state, setState] = useState<"loading" | "signedOut" | "connected" | "shared">(
    "loading"
  );
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getMe()
      .then((me) => setState(me.hasAlpacaKeys ? "connected" : "shared"))
      .catch((e) => setState(isSignedOut(e) ? "signedOut" : "shared"));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey.trim() || !secretKey.trim() || busy) return;
    setBusy(true);
    setNote(null);
    try {
      await setAlpacaKeys(apiKey.trim(), secretKey.trim());
      setState("connected");
      setApiKey("");
      setSecretKey("");
      setNote("Connected — your agent now trades your own paper account.");
    } catch (err) {
      setNote(
        err instanceof Error ? err.message : "Couldn't save keys — try again."
      );
    }
    setBusy(false);
  }

  return (
    <Card title="Brokerage connection (Alpaca paper)">
      {state === "signedOut" ? (
        <p className="text-sm text-ink-2">
          <Link href="/signin" className="font-medium text-series-1 hover:underline">
            Sign in
          </Link>{" "}
          to connect your own free Alpaca paper account. Until then, the shared
          demo account is shown.
        </p>
      ) : state === "connected" ? (
        <p className="text-sm text-ink-2">
          <span className="font-medium text-delta-up dark:text-good">
            Connected
          </span>{" "}
          — your agent trades your own paper account. Paste new keys below to
          replace them.
        </p>
      ) : state === "shared" ? (
        <p className="text-sm text-ink-2">
          Using the <span className="font-medium">shared demo account</span>.
          Create a free paper account at alpaca.markets (no credit card),
          generate paper API keys, and connect them here — then your agent
          manages a portfolio that&apos;s yours alone.
        </p>
      ) : null}
      {(state === "shared" || state === "connected") && (
        <form onSubmit={save} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paper API key"
            className="flex-1 rounded-lg border border-hairline bg-page px-3.5 py-2.5 text-sm outline-none placeholder:text-ink-muted focus:border-series-1"
          />
          <input
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            type="password"
            placeholder="Paper secret key"
            className="flex-1 rounded-lg border border-hairline bg-page px-3.5 py-2.5 text-sm outline-none placeholder:text-ink-muted focus:border-series-1"
          />
          <button
            type="submit"
            disabled={busy}
            className="btn-primary px-3.5 py-2 text-sm font-medium  disabled:opacity-50"
          >
            {busy ? "Checking…" : "Connect"}
          </button>
        </form>
      )}
      {note && <p className="mt-2 text-xs text-ink-2">{note}</p>}
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
      setSaveNote("Saved — the risk engine now enforces these values.");
      toast("success", fields.paused !== undefined
        ? fields.paused ? "Agent paused — pending proposals stay put, nothing new runs." : "Agent resumed."
        : "Safeguards saved — enforced on every order from now on.");
    } catch {
      setSaveNote("Couldn't save — sign in and try again.");
      toast("error", "Couldn't save settings — sign in and try again.");
    }
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">
          Settings &amp; safeguards
        </h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          Deterministic limits enforced by the risk engine — outside the
          model&apos;s control. Every proposed order must pass all of them.
        </p>
      </header>

      <BrokerageCard />

      <Card title="Agent status">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium">
              {sg.paused ? "Paused" : "Active"}
            </div>
            <p className="mt-0.5 text-sm text-ink-2">
              {sg.paused
                ? "The agent is stopped. Pending proposals are invalidated and no research cycles run."
                : "The agent runs research cycles and proposes trades within your safeguards."}
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
            {sg.paused ? "Resume agent" : "Pause agent (kill switch)"}
          </button>
        </div>
      </Card>

      <Card title="Approval mode">
        <div className="flex flex-col gap-2">
          <ModeRow
            checked={sg.approvalMode === "approve_each"}
            title="Approve each trade"
            body="Every order waits for your explicit approval before it is submitted. Default."
            onSelect={() => {
              setSg((s) => ({ ...s, approvalMode: "approve_each" }));
              persist({ safeguards: { approvalMode: "approve_each" } });
            }}
          />
          <ModeRow
            checked={sg.approvalMode === "autonomous_within_limits"}
            title="Autonomous within limits"
            body="The agent may execute paper trades on its own, but only inside the limits below. You are notified of every order. (Execution arrives with always-on mode.)"
            onSelect={() => {
              setSg((s) => ({ ...s, approvalMode: "autonomous_within_limits" }));
              persist({ safeguards: { approvalMode: "autonomous_within_limits" } });
            }}
          />
        </div>
      </Card>

      <Card title="Risk limits">
        <div className="grid gap-4 sm:grid-cols-2">
          <Limit
            label="Max position size"
            value={sg.maxPositionPct}
            suffix="% of portfolio"
            hint="A buy is blocked if the resulting allocation would exceed this."
            onChange={(v) => setSg((s) => ({ ...s, maxPositionPct: v }))}
          />
          <Limit
            label="Minimum cash"
            value={sg.minCashPct}
            suffix="% of portfolio"
            hint="Purchases cannot pull cash below this floor."
            onChange={(v) => setSg((s) => ({ ...s, minCashPct: v }))}
          />
          <Limit
            label="Max single order"
            value={sg.maxOrderPct}
            suffix="% of portfolio"
            hint="No single order can exceed this share of total value."
            onChange={(v) => setSg((s) => ({ ...s, maxOrderPct: v }))}
          />
          <Limit
            label="Max trades per day"
            value={sg.maxTradesPerDay}
            suffix="trades"
            hint="New trades beyond this count wait for the next day."
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
              {saving ? "Saving…" : "Save limits"}
            </button>
          </div>
        )}
      </Card>

      <Card title="Watchlist">
        <p className="mb-3 text-sm text-ink-2">
          The agent&apos;s starting point — it also scans market movers and can
          propose any US-listed stock. Automatic checks still reject unknown,
          OTC, and sub-$3 symbols. Edit the list on the Agent setup page.
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
          ? "These are your saved safeguards — the risk engine enforces them on every proposed order. Edit your universe on the Agent setup page."
          : "Sample values — sign in to configure your own safeguards."}
      </p>
    </div>
  );
}

function ModeRow({
  checked,
  title,
  body,
  onSelect,
}: {
  checked: boolean;
  title: string;
  body: string;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`rounded-lg border px-4 py-3 text-left transition-colors ${
        checked
          ? "border-series-1 bg-series-1/5"
          : "border-hairline hover:bg-ink/[0.03] dark:hover:bg-white/5"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={`inline-block size-3.5 rounded-full border-2 ${
            checked ? "border-series-1 bg-series-1" : "border-baseline"
          }`}
        />
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="mt-1 pl-[22px] text-sm text-ink-2">{body}</p>
    </button>
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

