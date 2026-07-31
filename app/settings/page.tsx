"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMe, isSignedOut, setAlpacaKeys } from "@/lib/api";
import { Card } from "@/components/ui";
import { safeguards as initial } from "@/lib/mock";

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
            className="rounded-lg bg-series-1 px-3.5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
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
            onClick={() => setSg((s) => ({ ...s, paused: !s.paused }))}
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
            onSelect={() => setSg((s) => ({ ...s, approvalMode: "approve_each" }))}
          />
          <ModeRow
            checked={sg.approvalMode === "autonomous_within_limits"}
            title="Autonomous within limits"
            body="The agent may execute paper trades on its own, but only inside the limits below. You are notified of every order."
            onSelect={() =>
              setSg((s) => ({ ...s, approvalMode: "autonomous_within_limits" }))
            }
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
      </Card>

      <Card title="Approved universe">
        <p className="mb-3 text-sm text-ink-2">
          The agent may only research and trade these symbols.
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
        Sample mode — changes here are local to this page. Settings persist to
        the database in Milestone 5, and the risk engine enforces them in
        Milestone 4.
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
