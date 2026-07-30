import type {
  ChatMessage,
  InvestorProfile,
  Strategy,
} from "./types";
import { decisions, portfolio, strategy as mockStrategy, profile as mockProfile } from "./mock";

// The deployed backend URL is injected at build time; localhost is the
// Milestone 3 default for local development.
const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

export interface InterpretedUpdate {
  profile: Omit<InvestorProfile, "version" | "updatedAt" | "rawInstructions">;
  strategy: Omit<Strategy, "version" | "updatedAt">;
}

export async function interpretProfile(
  instructions: string,
  current: { profile: InvestorProfile; strategy: Strategy }
): Promise<InterpretedUpdate> {
  const res = await fetch(`${API_URL}/interpret-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instructions,
      profile: current.profile,
      strategy: current.strategy,
    }),
  });
  if (!res.ok) throw new Error(`interpret-profile failed: ${res.status}`);
  return res.json();
}

export async function askAnalyst(messages: ChatMessage[]): Promise<string> {
  const res = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: messages.map((m) => ({ role: m.role, text: m.text })),
      // Milestone 3: account state is still the sample data. Milestone 5
      // replaces this with the signed-in user's records from the database.
      context: {
        profile: mockProfile,
        strategy: mockStrategy,
        portfolio,
        decisions,
      },
    }),
  });
  if (!res.ok) throw new Error(`chat failed: ${res.status}`);
  const data = (await res.json()) as { text: string };
  return data.text;
}
