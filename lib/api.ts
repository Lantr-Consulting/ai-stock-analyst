import { supabase } from "./supabase";
import type {
  ChatMessage,
  Decision,
  InvestorProfile,
  PortfolioSnapshot,
  Strategy,
  ValuePoint,
} from "./types";

// The deployed backend URL is injected at build time; localhost is the
// default for local development.
const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export function isSignedOut(e: unknown): boolean {
  return e instanceof ApiError && e.status === 401;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {}
    throw new ApiError(detail, res.status);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Me: the signed-in user's agent
// ---------------------------------------------------------------------------

export interface SafeguardSettings {
  approvedUniverse: string[];
  maxPositionPct: number;
  maxCorePositionPct: number;
  minCashPct: number;
  maxOrderPct: number;
  maxTradesPerDay: number;
  coreSymbols: string[];
  approvalMode?: string;
}

export interface Me {
  email: string;
  profile: Partial<Omit<InvestorProfile, "version" | "updatedAt" | "rawInstructions">>;
  strategy: Omit<Strategy, "version" | "updatedAt">;
  profileVersion: number;
  strategyVersion: number;
  rawInstructions: string[];
  hasAlpacaKeys: boolean;
  paused: boolean;
  activated: boolean;
  safeguards: SafeguardSettings;
}

export function getMe(): Promise<Me> {
  return req("/me");
}

export function updateSettings(payload: {
  safeguards?: Partial<SafeguardSettings>;
  universe?: string[];
  paused?: boolean;
}): Promise<{ ok: boolean; safeguards: SafeguardSettings; universe: string[]; paused: boolean }> {
  return req("/me/settings", { method: "PATCH", body: JSON.stringify(payload) });
}

export function activateAgent(): Promise<{ ok: boolean }> {
  return req("/me/activate", { method: "POST", body: "{}" });
}

export function setAlpacaKeys(apiKey: string, secretKey: string): Promise<{ ok: boolean }> {
  return req("/me/alpaca-keys", {
    method: "POST",
    body: JSON.stringify({ apiKey, secretKey }),
  });
}

// ---------------------------------------------------------------------------
// Portfolio (the signed-in user's paper account)
// ---------------------------------------------------------------------------

export interface LivePortfolio extends PortfolioSnapshot {
  equity: number;
  history: ValuePoint[];
  sharedDemoAccount: boolean;
}

export function getPortfolio(): Promise<LivePortfolio> {
  return req("/portfolio");
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

export function getDecisions(): Promise<Decision[]> {
  return req("/decisions");
}

export function runResearchCycle(): Promise<{ runId: string; status: string }> {
  return req("/research-cycle", { method: "POST", body: "{}" });
}

export interface ResearchRun {
  id: string;
  status: "running" | "done" | "error";
  steer: string[];
  error?: string | null;
  report?: string | null;
  automation_id?: string | null;
  started_at: string;
  finished_at?: string | null;
  decisions: Decision[];
}

export function getResearchRuns(): Promise<ResearchRun[]> {
  return req("/research-runs");
}

export function steerRun(id: string, text: string): Promise<{ ok: boolean; note: string }> {
  return req(`/research-runs/${id}/steer`, { method: "POST", body: JSON.stringify({ text }) });
}

export interface Thread {
  id: string;
  title: string;
  created_at: string;
}

export function getThreads(): Promise<Thread[]> {
  return req("/threads");
}

export function newThread(): Promise<Thread> {
  return req("/threads", { method: "POST", body: "{}" });
}

export function approveDecision(id: string, qty?: number): Promise<Decision> {
  return req(`/decisions/${id}/approve`, {
    method: "POST",
    body: JSON.stringify(qty ? { qty } : {}),
  });
}

export function rejectDecision(id: string, reason?: string): Promise<Decision> {
  return req(`/decisions/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason: reason ?? null }),
  });
}

// ---------------------------------------------------------------------------
// Brain
// ---------------------------------------------------------------------------

export interface InterpretResult {
  profile: Me["profile"];
  strategy: Me["strategy"];
  profileVersion: number;
  strategyVersion: number;
  rawInstructions: string[];
}

export function interpretProfile(instructions: string): Promise<InterpretResult> {
  return req("/interpret-profile", {
    method: "POST",
    body: JSON.stringify({ instructions }),
  });
}

export async function askAnalyst(
  messages: ChatMessage[],
  threadId?: string
): Promise<{ text: string; strategyUpdated: boolean; threadId: string }> {
  return req("/chat", {
    method: "POST",
    body: JSON.stringify({
      messages: messages.map((m) => ({ role: m.role, text: m.text })),
      threadId: threadId ?? null,
    }),
  });
}

export function getChatHistory(threadId?: string): Promise<ChatMessage[]> {
  return req(`/chat/history${threadId ? `?threadId=${threadId}` : ""}`);
}

// ---------------------------------------------------------------------------
// Automations
// ---------------------------------------------------------------------------

export interface Automation {
  id: string;
  title: string;
  prompt: string;
  cadence: "manual" | "daily" | "weekly" | "market_open";
  hour_utc: number;
  enabled: boolean;
  last_run_at?: string | null;
}

export function getAutomations(): Promise<Automation[]> {
  return req("/automations");
}

export function createAutomation(a: {
  title: string;
  prompt: string;
  cadence: string;
  hourUtc: number;
}): Promise<Automation> {
  return req("/automations", { method: "POST", body: JSON.stringify(a) });
}

export function toggleAutomation(id: string, enabled: boolean): Promise<Automation> {
  return req(`/automations/${id}`, { method: "PATCH", body: JSON.stringify({ enabled }) });
}

export function deleteAutomation(id: string): Promise<{ ok: boolean }> {
  return req(`/automations/${id}`, { method: "DELETE" });
}

export function runAutomation(id: string): Promise<{ ok: boolean }> {
  return req(`/automations/${id}/run`, { method: "POST", body: "{}" });
}

// ---------------------------------------------------------------------------
// Market discovery (public)
// ---------------------------------------------------------------------------

export interface Mover {
  symbol: string;
  pctChange: number;
  price: number;
}

export function getMarketOverview(): Promise<{
  gainers?: Mover[];
  losers?: Mover[];
  mostActive?: { symbol: string; volume: number }[];
  sparks?: Record<string, number[]>;
}> {
  return req("/market/overview");
}

export interface TickerDetail {
  info: { symbol: string; name: string; exchange: string; tradable: boolean };
  indicators: {
    price: number;
    sma20?: number | null;
    sma50?: number | null;
    rsi14?: number;
    annualizedVolPct?: number;
    maxDrawdown60dPct?: number;
    return30dPct?: number | null;
    error?: string;
  } | null;
  bars: { date: string; close: number }[];
  news: { headline: string; source: string; at: string; summary: string }[];
}

export function getTicker(symbol: string): Promise<TickerDetail> {
  return req(`/market/ticker/${encodeURIComponent(symbol)}`);
}
