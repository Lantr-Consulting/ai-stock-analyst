# AI Stock Analyst Agent

Your personal AI stock analyst and portfolio manager: it learns how you invest
in plain English, watches the market, proposes evidence-backed trades, and
manages a **paper-trading portfolio** within deterministic safeguards.

> **Simulated.** Everything in this app runs against a paper-trading account.
> No real money is invested, and nothing here is financial advice.

A Lantr sample project, built in the same order a student builds theirs.

## Status: Milestone 1 — First Ship

The frontend is live with sample data. Six screens:

- **Dashboard** — portfolio value, allocation, recent decisions, weekly summary
- **Agent setup** — plain-English instructions → investor profile → strategy preview
- **Proposals** — evidence, safeguard checks, approve/reject
- **Ask the analyst** — interrogate any decision
- **Activity** — the full auditable record
- **Settings & safeguards** — risk limits, approval mode, kill switch

## Roadmap

| Milestone | What ships |
|---|---|
| 1. First Ship | Frontend on Vercel, sample data *(this one)* |
| 2. Design pass | Visual polish, states, charts |
| 3. The Brain | Python backend on Railway; Claude turns instructions into a strategy |
| 4. Hands | LangChain agent + Alpaca tools; risk engine; approval → paper order → fill |
| 5. Memory & accounts | Supabase database, sign-in, one agent per user |
| 6. Always-on | Scheduled research cycles, summaries, notifications |
| 7. Evals | Committed eval set, LLM-as-judge, measured improvement |

## Stack

Next.js + Tailwind on Vercel (this repo) · Python + LangChain + Claude on
Railway · Alpaca paper trading & market data · Supabase (Postgres + auth).

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.
