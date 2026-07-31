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

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Portfolio (live paper account, Milestone 4)
// ---------------------------------------------------------------------------

export interface LivePortfolio extends PortfolioSnapshot {
  equity: number;
  history: ValuePoint[];
}

export function getPortfolio(): Promise<LivePortfolio> {
  return req("/portfolio");
}

// ---------------------------------------------------------------------------
// Decisions: research -> propose -> approve/reject
// ---------------------------------------------------------------------------

export function getDecisions(): Promise<Decision[]> {
  return req("/decisions");
}

export function runResearchCycle(): Promise<Decision> {
  return req("/research-cycle", { method: "POST", body: "{}" });
}

export function approveDecision(id: string): Promise<Decision> {
  return req(`/decisions/${id}/approve`, { method: "POST", body: "{}" });
}

export function rejectDecision(id: string): Promise<Decision> {
  return req(`/decisions/${id}/reject`, { method: "POST", body: "{}" });
}

// ---------------------------------------------------------------------------
// Brain (Milestone 3)
// ---------------------------------------------------------------------------

export interface InterpretedUpdate {
  profile: Omit<InvestorProfile, "version" | "updatedAt" | "rawInstructions">;
  strategy: Omit<Strategy, "version" | "updatedAt">;
}

export function interpretProfile(
  instructions: string,
  current: { profile: InvestorProfile; strategy: Strategy }
): Promise<InterpretedUpdate> {
  return req("/interpret-profile", {
    method: "POST",
    body: JSON.stringify({
      instructions,
      profile: current.profile,
      strategy: current.strategy,
    }),
  });
}

export async function askAnalyst(messages: ChatMessage[]): Promise<string> {
  const data = await req<{ text: string }>("/chat", {
    method: "POST",
    body: JSON.stringify({
      messages: messages.map((m) => ({ role: m.role, text: m.text })),
    }),
  });
  return data.text;
}
