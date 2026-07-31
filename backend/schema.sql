-- Milestone 5: Memory & accounts.
-- One agent per user; decisions are per-user records.
-- Writes go through the backend (service key). Row-Level Security means a
-- signed-in user can only ever read their own rows: two people, two worlds.

create table if not exists public.agents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  profile jsonb not null default '{}'::jsonb,
  strategy jsonb not null default '{}'::jsonb,
  profile_version int not null default 0,
  strategy_version int not null default 0,
  raw_instructions jsonb not null default '[]'::jsonb,
  alpaca_api_key text,
  alpaca_secret_key text,
  paused boolean not null default false,
  safeguards jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.decisions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  action text not null,
  symbol text,
  qty numeric,
  est_value numeric,
  rationale text not null default '',
  strategy_version int not null default 0,
  evidence jsonb not null default '[]'::jsonb,
  safeguards jsonb not null default '[]'::jsonb,
  status text not null,
  order_record jsonb
);

create index if not exists decisions_user_created
  on public.decisions (user_id, created_at desc);

alter table public.agents enable row level security;
alter table public.decisions enable row level security;

drop policy if exists "read own agent" on public.agents;
create policy "read own agent" on public.agents
  for select using ((select auth.uid()) = user_id);

drop policy if exists "read own decisions" on public.decisions;
create policy "read own decisions" on public.decisions
  for select using ((select auth.uid()) = user_id);

-- Quant upgrade: agents are inactive until the user completes onboarding
-- (reviews the interpreted strategy, edits universe/safeguards, activates).
alter table public.agents add column if not exists activated boolean not null default false;
alter table public.decisions add column if not exists feedback text;
