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
        "Type an instruction first — for example, a sector you like or a company to avoid."
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
        "Saved — this is now the strategy your agent researches with. Review how it interpreted you below."
      );
    } catch (e) {
      setNote(
        isSignedOut(e)
          ? "Sign in first — your profile is saved to your own agent."
          : "Couldn't reach the analyst backend — try again in a moment."
      );
    }
    setBusy(false);
  }

  const v = view ?? SAMPLE;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Agent setup</h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          {status === "signedOut" ? (
            <>
              Sample profile —{" "}
              <Link href="/signin" className="font-medium text-series-1 hover:underline">
                sign in
              </Link>{" "}
              to teach your own agent
            </>
          ) : (
            "Tell the agent what matters in plain English. It turns your instructions into an investor profile and a personalised strategy — saved to your agent and used on every research cycle."
          )}
        </p>
      </header>

      <Card title="Tell the agent what matters">
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          placeholder={`e.g. "I like large technology companies, I'm comfortable with moderate risk, and I think AI infrastructure will continue growing."`}
          className="w-full resize-none rounded-lg border border-hairline bg-page px-3.5 py-2.5 text-sm outline-none placeholder:text-ink-muted focus:border-series-1"
        />
        <div className="mt-3 flex items-center justify-end">
          <button
            onClick={update}
            disabled={busy || status === "signedOut"}
            className="rounded-lg bg-series-1 px-3.5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Interpreting…" : "Update profile"}
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
          title={`Investor profile · v${v.profileVersion}`}
          className={updated ? "ring-1 ring-series-1/40" : ""}
        >
          {!v.profile.goals ? (
            <p className="text-sm text-ink-2">
              Nothing here yet — describe how you invest above and the agent
              builds your profile from your own words.
            </p>
          ) : (
            <dl className="flex flex-col gap-3 text-sm">
              <Row label="Goals" value={v.profile.goals ?? ""} />
              <Row
                label="Risk tolerance"
                value={
                  v.profile.riskTolerance
                    ? v.profile.riskTolerance[0].toUpperCase() +
                      v.profile.riskTolerance.slice(1)
                    : "—"
                }
              />
              <Row label="Time horizon" value={v.profile.timeHorizon ?? "—"} />
              <Row
                label="Preferred sectors"
                value={(v.profile.preferredSectors ?? []).join(" · ")}
              />
              <Row label="Avoids" value={(v.profile.avoid ?? []).join(" · ")} />
              <Row
                label="Trading frequency"
                value={v.profile.tradingFrequency ?? "—"}
              />
            </dl>
          )}
          {v.rawInstructions.length > 0 && (
            <div className="mt-4 border-t border-hairline pt-3">
              <div className="text-xs font-medium text-ink-muted">
                Your instructions, verbatim
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
          title={`Strategy preview · v${v.strategyVersion}`}
          className={updated ? "ring-1 ring-series-1/40" : ""}
        >
          <p className="text-sm leading-relaxed text-ink-2">
            {v.strategy.summary}
          </p>
          {v.strategy.watching?.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-medium text-ink-muted">
                What the agent watches
              </div>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-ink-2">
                {v.strategy.watching.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4">
            <div className="text-xs font-medium text-ink-muted">Rules</div>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-ink-2">
              {v.strategy.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <div className="mt-4">
            <div className="text-xs font-medium text-ink-muted">
              Approved universe
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
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Activation failed — try again.");
    }
    setBusy(false);
  }

  if (done) {
    return (
      <Card className="ring-1 ring-good/40">
        <p className="text-sm">
          <span className="font-medium text-delta-up dark:text-good">
            Agent activated.
          </span>{" "}
          <Link href="/proposals" className="font-medium text-series-1 hover:underline">
            Run your first research cycle →
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card title="Step 2 — review and activate" className="ring-1 ring-series-1/40">
      {!ready ? (
        <p className="text-sm text-ink-2">
          Your agent is <span className="font-medium">not active yet</span>.
          Start above: describe how you invest, and the agent will propose a
          strategy, watchlist, and safeguards for you to review here.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-2 text-xs font-medium text-ink-muted">
              Starting watchlist — the agent researches these first, but also
              scans market movers and may propose any US-listed stock that
              fits your profile. Edit freely, or leave as-is.
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {universe.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-full border border-hairline px-2.5 py-0.5 text-xs font-medium"
                >
                  {s}
                  <button
                    aria-label={`Remove ${s}`}
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
                  placeholder="+ add symbol"
                  className="w-28 rounded-full border border-dashed border-hairline bg-transparent px-2.5 py-0.5 text-xs outline-none placeholder:text-ink-muted focus:border-series-1"
                />
              </form>
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-medium text-ink-muted">
              Safeguards — hard limits enforced by code on every order. Yours
              to set.
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumField label="Max position %" value={sg.maxPositionPct} onChange={(v) => setSg((s) => ({ ...s, maxPositionPct: v }))} />
              <NumField label="Min cash %" value={sg.minCashPct} onChange={(v) => setSg((s) => ({ ...s, minCashPct: v }))} />
              <NumField label="Max order %" value={sg.maxOrderPct} onChange={(v) => setSg((s) => ({ ...s, maxOrderPct: v }))} />
              <NumField label="Trades / day" value={sg.maxTradesPerDay} onChange={(v) => setSg((s) => ({ ...s, maxTradesPerDay: v }))} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-ink-muted">
              Nothing runs until you activate. You can change all of this any
              time in Settings.
            </p>
            <button
              onClick={activate}
              disabled={busy || universe.length === 0}
              className="shrink-0 rounded-lg bg-series-1 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Activating…" : "Activate agent"}
            </button>
          </div>
          {err && <p className="text-xs text-critical">{err}</p>}
        </div>
      )}
    </Card>
  );
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
