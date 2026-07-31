# AI Stock Analyst — Design, Scope & Reconstruction Guide

> The reference build for Lantr's AI project service. A student with zero
> experience, following the AI Agent Builder track, ends with this: a live,
> multi-user AI portfolio manager on a paper-trading account. This document
> records what was built, how, in what order, and what we learned — so the
> course can be tuned around it.
>
> **Live:** https://ai-stock-analyst-seven.vercel.app · **Paper trading only.
> Simulated. Not financial advice.**

---

## 1. What it is

**One-liner:** *AI Stock Analyst is for beginner investors who don't know
tickers or charts. You describe how you want to invest in plain English, and
it researches the live market, proposes safeguard-checked trades you approve
with one click, runs standing missions on a schedule, and answers for every
decision it makes.*

**Minimum complete product:** a signed-in user can describe their investing
style, review and activate the interpreted strategy, run live research that
produces sized order proposals, approve/reject them (approvals become real
paper orders on Alpaca), converse with an analyst grounded in their records,
and schedule recurring research — with every screen labeled simulated.

**Control model:** the LLM proposes; deterministic code disposes. Every order
passes coded safeguards (position %, cash floor, order size, trade frequency,
tradable-asset check, penny-stock floor, duplicate/open-order prevention) and
requires explicit human approval. The user owns every limit.

## 2. Final capability map

| Surface | Capabilities |
|---|---|
| **Dashboard** | Live equity + history chart, cash/gain/positions tiles, allocation bar, positions table (value, total P/L $ and %, today), recent decisions |
| **Discover** | Market movers with sparklines (gainers/losers/most active), any-ticker lookup (Robinhood-style hero price + day/30d change, gradient chart with timeframes, RSI/SMA/vol/drawdown/prev-close/avg-volume/60d-range), your holdings & watchlist rows with P/L, position-aware "Research with analyst" handoff |
| **Analyst** | Threaded persistent chat (markdown), live tools (asset lookup, prices, indicators, news), launches research into the conversation, live progress bar, inline Robinhood-style order tickets with editable share counts, right rail of conversations + trade history |
| **Automations** | User-authored standing missions (custom prompt + cadence: manual / market open / daily / weekly), results presented per-automation (running state, latest report, past runs), scheduler with cross-worker claim |
| **Investor profile** | Plain-English instructions → versioned profile + strategy (risk meter, sector pills, check-row rules, watchlist); review-and-activate onboarding; nothing runs until the user blesses it |
| **Settings** | Per-user safeguards (persisted, enforced), approval mode, pause/kill switch, own Alpaca paper keys (validated; shared demo fallback) |
| **Cross-cutting** | Magic-link auth, Row-Level Security ("two people, two worlds"), reject-with-reason feedback the agent obeys, activity bell with dropdown, optimistic UI + toasts, dark/light themes |

## 3. Architecture

```
Browser (Next.js on Vercel)
   │  supabase-js session token on every request
   ▼
FastAPI on Railway (2 uvicorn workers)
   ├─ auth.py      Bearer token → Supabase /auth/v1/user → user id
   ├─ main.py      endpoints + scheduler thread + research runner (threads)
   ├─ agent.py     LangChain tool-calling research agent (DeepSeek)
   ├─ broker.py    Alpaca: account, orders, prices, bars, news, movers, indicators
   ├─ risk.py      deterministic safeguards (pure code)
   └─ db.py        PostgREST client (service key) → Supabase Postgres
External: DeepSeek (LLM, OpenAI-compatible) · Alpaca (paper trading + market
data + news + screener) · Supabase (Postgres, Auth, RLS)
```

**Stack (all free tier, no credit card):** Next.js + Tailwind 4 on Vercel ·
Python FastAPI + LangChain on Railway · DeepSeek `deepseek-chat` (students may
use Claude) · Alpaca paper API · Supabase.

**Data model** (`backend/schema.sql`): `agents` (one per user: profile jsonb,
strategy jsonb + versions, safeguards jsonb, per-user Alpaca keys, activated,
paused) · `decisions` (action, symbol, qty, est_value, rationale, evidence[],
safeguards[], status, order_record, feedback, run_id) · `research_runs`
(status, steer[], report, automation_id) · `threads` + `messages` (chat) ·
`automations` (title, prompt, cadence, hour_utc, enabled, last_run_at).
RLS: users can only read their own rows; writes go through the backend.

**Key API surface:** `/me`, `/me/settings`, `/me/activate`, `/me/alpaca-keys`,
`/interpret-profile`, `/portfolio`, `/decisions` (+ `/approve` with edited
qty, `/reject` with reason), `/research-cycle` → async `runId`,
`/research-runs` (+ `/steer`), `/chat` (+ `/chat/history`), `/threads`,
`/automations` (+ `/run`), public `/market/overview`, `/market/ticker/{sym}`,
`/market/sparklines`.

## 4. Reconstruction: phase by phase

Each phase is a working session ending with a deploy and a git tag. Phases
1–5 map directly onto the existing course modules; 6–10 are the "make it a
real product" arc driven by user feedback — the best teaching material in the
project.

### Phase 1 — First Ship: the face (course M1–M5)
Scaffold Next.js + Tailwind. Build all six screens against **typed mock data
shaped like the real records** (`lib/types.ts`, `lib/mock.ts`) — this is the
trick that lets later phases swap mocks for APIs without reshaping UI. Push
to GitHub, deploy to Vercel. *Gotchas we hit: npm rejects capitalized folder
names; Vercel Hobby blocks CLI deploys whose commit email isn't linked to a
connected GitHub account (fix: connect the repo, ship via push), and private
org repos need a paid plan (fix: public repo — scan history for secrets
first).*

### Phase 2 — Design pass (course M6)
Design tokens in `globals.css`, wordmark + icon nav, hero number over the
chart, focus states, favicon. Verify in the browser, not just the build.

### Phase 3 — The Brain (course M7–M8)
FastAPI backend: `/interpret-profile` (plain English + current state → JSON
profile/strategy via JSON-mode prompt) and `/chat` (grounded in account
state). Deploy to Railway (`Procfile`, env vars, `.railwayignore` for venv +
.env). Wire the two screens with graceful offline fallbacks. *Gotchas:
deploy from `backend/` only; pin transitive deps (alpaca-py silently needs
`pytz` on py3.13).*

### Phase 4 — Hands (course M9–M10)
LangChain tool-calling agent: portfolio, latest prices, daily bars, news
tools; evidence captured from intermediate steps onto the decision record.
`risk.py` safeguards run in code,再-checked at approval time. Approve →
market order to Alpaca → fill reconciliation on read. *Teaching gold: our
first live run proposed a $34.7k VOO buy and the risk engine blocked it —
model proposes, code disposes. Also: return tool errors to the agent as data
(a hallucinated ticker like `C3.AI` must not crash the run).*

### Phase 5 — Memory & accounts (course M11–M12)
Supabase: schema above, magic-link sign-in, RLS read-own policies, backend
auth dependency, per-user Alpaca keys with validation + shared-demo fallback,
decisions/threads move to Postgres. *Gotchas: Supabase free email = ~2
magic links/hour (plan Resend SMTP); set Site URL + redirect allowlist;
admin `generate_link` is your test harness.*

### Phase 6 — The quant upgrade (new module candidate: "Make it feel real")
Everything here came from one round of honest user feedback ("this doesn't
feel like a quant; I never chose any of this"):
- **Onboarding:** new agents start empty + inactive; describe → review
  interpreted strategy, watchlist, safeguard numbers → explicit Activate.
- **Portfolio-wide research:** target allocation + basket of ≤5 orders, each
  individually safeguard-checked; indicators toolkit (SMA20/50, RSI14,
  annualized vol, drawdown, 30d return) computed from bars in plain Python.
- **Open discovery:** the watchlist is non-binding; agent scans market movers
  and sector peers; whitelist safeguard replaced by tradable-asset + $3
  floor checks. **Scrub the old language from every prompt** — chat,
  interpreter, and research must agree.
- **Feedback loop:** reject-with-reason stored on the decision; last N
  verdicts injected into research as standing instructions.

### Phase 7 — Workspace (new module candidate: "One coherent agent")
Async research runs (background thread + DB-status polling + progress UI +
mid-run steering saved for the next cycle), threaded chat with history,
supersession of stale proposals, per-user run lock **in the database** (an
in-memory lock dies with multiple workers). *Gotcha that matters: one uvicorn
worker means a long research run starves chat — run 2 workers and move locks
to the DB (CAS on a column).*

### Phase 8 — Automations (course M6b: always-on)
`automations` table + CRUD + "Run now"; scheduler loop (60s) claims due
automations via compare-and-swap so exactly one worker fires; mission prompt
injected into the research agent; report saved on the run and presented on
the automation's own card (chat-initiated research reports into its thread
instead — keep the surfaces separate).

### Phase 9 — Market discovery (course M10 extension)
Public endpoints over Alpaca's screener + one batched bars call for
sparklines. Discover page: movers columns, your holdings/watchlist, and the
Robinhood-layout ticker page (hero, timeframe chart, buy ticket → analyst
handoff, position P/L panel when held).

### Phase 10 — Product polish (threaded through everything)
Robinhood-grade theme (black canvas, lime CTA pills, signal green/red, light
mode via a second token set), markdown chat bubbles, order-ticket cards with
editable quantities everywhere, status filters, optimistic actions + toast
banners, notification bell, sticky rails, internal scroll model.

## 5. Lessons worth teaching explicitly

1. **Model proposes, code disposes.** Every real safety property lives in
   `risk.py` and the approval flow, not in the prompt.
2. **Never let the agent assert market facts from memory.** SpaceX IPO'd
   after every model's cutoff (ticker SPCX); the analyst confidently denied
   it until we gave chat live tools and a "verify, then answer" rule.
3. **Tool errors are data.** Wrap every tool; return the error string to the
   model and let it self-correct.
4. **Pending state must be visible.** Accepted-but-unfilled orders caused
   duplicate proposals until open orders joined the portfolio snapshot and
   the duplicate safeguard.
5. **Patch prompts with asserts.** Two of our prompt "fixes" silently
   no-opped because the target text had drifted — the bug shipped for hours.
6. **Users configure nothing they didn't bless** — and everything they did
   bless is enforced, persisted, and inspectable.
7. **Ship every session.** Vercel push-to-deploy + Railway CLI + git tags per
   phase meant every feedback round landed in production within minutes.

## 6. Deliberately out of scope (and what remains)

Out (per the design doc): live brokerage money, options/short/margin/crypto,
guaranteed-performance claims. Remaining for a complete flagship: Resend SMTP
(magic-link volume + emailed automation reports), autonomous execution mode
within safeguards, buying-power cash reservation, the Milestone-7 eval set +
LLM-as-judge + one measured improvement, and `BLUEPRINT.md` as the Demo Day
package. Two Dependabot alerts remain that only clear with the langchain 1.x
(LangGraph) migration.

## 7. Course-tuning notes

- Phases 1–5 validate the existing M1–M12 arc almost exactly; this repo's
  tags (`milestone-1-first-ship` … `milestone-6b-automations`) are checkout
  points for mentors to show intermediate states.
- The richest new material is Phases 6–7: a structured "user feedback lab"
  where the student ships, watches a real user struggle, and iterates — every
  complaint in section 5 started as a real session transcript.
- Keys students need (all free): Alpaca paper key/secret, an LLM key
  (Claude via the Lantr gateway or DeepSeek), Supabase project URL +
  publishable + secret keys. Never commit any of them; `.env` + platform
  variables only; scan history before making a repo public.
