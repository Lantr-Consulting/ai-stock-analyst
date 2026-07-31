"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMe, interpretProfile, isSignedOut, type Me } from "@/lib/api";
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

  useEffect(() => {
    getMe()
      .then((me) => setView(me))
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

      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title={`Investor profile · v${v.profileVersion}`}
          className={updated ? "ring-1 ring-series-1/40" : ""}
        >
          <dl className="flex flex-col gap-3 text-sm">
            <Row label="Goals" value={v.profile.goals} />
            <Row
              label="Risk tolerance"
              value={
                v.profile.riskTolerance[0].toUpperCase() +
                v.profile.riskTolerance.slice(1)
              }
            />
            <Row label="Time horizon" value={v.profile.timeHorizon} />
            <Row
              label="Preferred sectors"
              value={v.profile.preferredSectors.join(" · ")}
            />
            <Row label="Avoids" value={v.profile.avoid.join(" · ")} />
            <Row label="Trading frequency" value={v.profile.tradingFrequency} />
          </dl>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
