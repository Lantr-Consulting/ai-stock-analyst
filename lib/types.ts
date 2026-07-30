// Core records, mirroring the project design doc. In Milestone 1 these are
// filled with mock data (lib/mock.ts); later milestones swap the mocks for
// real API responses without reshaping the UI.

export type RiskLevel = "conservative" | "moderate" | "aggressive";

export interface InvestorProfile {
  version: number;
  updatedAt: string;
  rawInstructions: string[];
  goals: string;
  riskTolerance: RiskLevel;
  timeHorizon: string;
  preferredSectors: string[];
  avoid: string[];
  marketViews: string[];
  tradingFrequency: string;
}

export interface Strategy {
  version: number;
  updatedAt: string;
  summary: string;
  watching: string[];
  rules: string[];
  universe: string[];
}

export interface Position {
  symbol: string;
  name: string;
  shares: number;
  costBasis: number; // per share
  price: number; // latest
}

export interface PortfolioSnapshot {
  asOf: string;
  cash: number;
  positions: Position[];
}

export interface ValuePoint {
  date: string;
  value: number;
}

export type SafeguardStatus = "pass" | "fail";

export interface SafeguardCheck {
  name: string;
  detail: string;
  status: SafeguardStatus;
}

export type DecisionAction = "buy" | "sell" | "hold" | "rebalance" | "no_action";

export type DecisionStatus =
  | "proposed"
  | "approved"
  | "rejected"
  | "filled"
  | "blocked";

export interface EvidenceItem {
  source: string;
  timestamp: string;
  summary: string;
}

export interface OrderRecord {
  id: string;
  submittedAt: string;
  status: "submitted" | "filled" | "cancelled";
  filledAt?: string;
  fillPrice?: number;
}

export interface Decision {
  id: string;
  createdAt: string;
  action: DecisionAction;
  symbol?: string;
  qty?: number;
  estValue?: number;
  rationale: string;
  strategyVersion: number;
  evidence: EvidenceItem[];
  safeguards: SafeguardCheck[];
  status: DecisionStatus;
  order?: OrderRecord;
}

export type ActivityKind =
  | "research"
  | "proposal"
  | "approval"
  | "order"
  | "fill"
  | "blocked"
  | "summary"
  | "profile";

export interface ActivityEvent {
  id: string;
  at: string;
  kind: ActivityKind;
  title: string;
  detail: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  at: string;
}

export interface Safeguards {
  approvedUniverse: string[];
  maxPositionPct: number;
  minCashPct: number;
  maxOrderPct: number;
  maxTradesPerDay: number;
  approvalMode: "approve_each" | "autonomous_within_limits";
  paused: boolean;
}
