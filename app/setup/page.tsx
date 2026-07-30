"use client";

import { useState } from "react";
import { interpretProfile } from "@/lib/api";
import { Card } from "@/components/ui";
import { profile as initialProfile, strategy as initialStrategy } from "@/lib/mock";
import type { InvestorProfile, Strategy } from "@/lib/types";

export default function SetupPage() {
  const [instructions, setInstructions] = useState("");
  const [profile, setProfile] = useState<InvestorProfile>(initialProfile);
  const [strategy, setStrategy] = useState<Strategy>(initialStrategy);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [updated, setUpdated] = useState(false);

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
      const result = await interpretProfile(t, { profile, strategy });
      const now = new Date().toISOString();
      setProfile((p) => ({
        ...p,
        ...result.profile,
        version: p.version + 1,
        updatedAt: now,
        rawInstructions: [...p.rawInstructions, t],
      }));
      setStrategy((s) => ({
        ...s,
        ...result.strategy,
        version: s.version + 1,
        updatedAt: now,
      }));
      setInstructions("");
      setUpdated(true);
      setNote(
        "Profile updated — review how the agent interpreted you below. (Saved profiles arrive with the database in Milestone 5.)"
      );
    } catch {
      setNote(
        "Couldn't reach the analyst backend — start backend/ on port 8000 or check NEXT_PUBLIC_API_URL, then try again."
      );
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Agent setup</h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          Tell the agent what matters in plain English. It turns your
          instructions into an investor profile and a personalised strategy you
          can review before anything runs.
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
            disabled={busy}
            className="rounded-lg bg-series-1 px-3.5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Interpreting…" : "Update profile"}
          </button>
        </div>
        {note && <p className="mt-2 text-xs text-ink-2">{note}</p>}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title={`Investor profile · v${profile.version}`}
          className={updated ? "ring-1 ring-series-1/40" : ""}
        >
          <dl className="flex flex-col gap-3 text-sm">
            <Row label="Goals" value={profile.goals} />
            <Row
              label="Risk tolerance"
              value={
                profile.riskTolerance[0].toUpperCase() +
                profile.riskTolerance.slice(1)
              }
            />
            <Row label="Time horizon" value={profile.timeHorizon} />
            <Row
              label="Preferred sectors"
              value={profile.preferredSectors.join(" · ")}
            />
            <Row label="Avoids" value={profile.avoid.join(" · ")} />
            <Row label="Trading frequency" value={profile.tradingFrequency} />
          </dl>
          <div className="mt-4 border-t border-hairline pt-3">
            <div className="text-xs font-medium text-ink-muted">
              Your instructions, verbatim
            </div>
            <ul className="mt-2 flex flex-col gap-1.5">
              {profile.rawInstructions.map((r) => (
                <li key={r} className="text-sm text-ink-2">
                  &ldquo;{r}&rdquo;
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card
          title={`Strategy preview · v${strategy.version}`}
          className={updated ? "ring-1 ring-series-1/40" : ""}
        >
          <p className="text-sm leading-relaxed text-ink-2">
            {strategy.summary}
          </p>
          <div className="mt-4">
            <div className="text-xs font-medium text-ink-muted">
              What the agent watches
            </div>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-ink-2">
              {strategy.watching.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
          <div className="mt-4">
            <div className="text-xs font-medium text-ink-muted">Rules</div>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-ink-2">
              {strategy.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <div className="mt-4">
            <div className="text-xs font-medium text-ink-muted">
              Approved universe
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {strategy.universe.map((s) => (
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
