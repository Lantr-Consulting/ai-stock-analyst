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

export function runResearchCycle(): Promise<{ plan: Decision; orders: Decision[] }> {
  return req("/research-cycle", { method: "POST", body: "{}" });
}

export function approveDecision(id: string): Promise<Decision> {
  return req(`/decisions/${id}/approve`, { method: "POST", body: "{}" });
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
  messages: ChatMessage[]
): Promise<{ text: string; strategyUpdated: boolean }> {
  return req("/chat", {
    method: "POST",
    body: JSON.stringify({
      messages: messages.map((m) => ({ role: m.role, text: m.text })),
    }),
  });
}

export function getChatHistory(): Promise<ChatMessage[]> {
  return req("/chat/history");
}
