import type {
  ActivityEvent,
  ChatMessage,
  Decision,
  InvestorProfile,
  PortfolioSnapshot,
  Safeguards,
  Strategy,
  ValuePoint,
} from "./types";

// ---------------------------------------------------------------------------
// Milestone 1 mock data. Everything on screen is simulated paper trading.
// ---------------------------------------------------------------------------

export const profile: InvestorProfile = {
  version: 3,
  updatedAt: "2026-07-27T09:12:00-07:00",
  rawInstructions: [
    "I like large technology companies and I'm comfortable with moderate risk.",
    "I think AI infrastructure will keep growing for the next few years.",
    "Keep at least some of the portfolio in a broad index fund, and don't trade more than a couple of times a week.",
  ],
  goals: "Grow a long-term portfolio while learning how markets work",
  riskTolerance: "moderate",
  timeHorizon: "3–5 years",
  preferredSectors: ["Technology", "AI infrastructure", "Broad-market ETFs"],
  avoid: ["Penny stocks", "Options, margin, and crypto (out of scope)"],
  marketViews: [
    "AI infrastructure demand keeps growing",
    "Prefers profitable large caps over speculative names",
  ],
  tradingFrequency: "Up to 2 new trades per week",
};

export const strategy: Strategy = {
  version: 3,
  updatedAt: "2026-07-27T09:12:00-07:00",
  summary:
    "Hold a core broad-market position, tilt toward large-cap technology and AI infrastructure, add on evidence-backed opportunities, and keep a cash buffer for pullbacks.",
  watching: [
    "AI infrastructure earnings and guidance (NVDA, MSFT, AVGO)",
    "Broad-market trend vs. the VOO benchmark",
    "News that changes the thesis for any held position",
  ],
  rules: [
    "Core: keep 30–50% in VOO as the portfolio anchor",
    "Tilt: up to 15% per single technology position",
    "Buy only with at least two independent pieces of supporting evidence",
    "Hold at least 10% cash at all times",
    "Propose, don't execute — every order needs approval",
  ],
  universe: ["AAPL", "MSFT", "NVDA", "AMZN", "AVGO", "VOO", "QQQ"],
};

export const portfolio: PortfolioSnapshot = {
  asOf: "2026-07-30T13:00:00-07:00",
  cash: 2412.55,
  positions: [
    { symbol: "VOO", name: "Vanguard S&P 500 ETF", shares: 7, costBasis: 512.1, price: 538.42 },
    { symbol: "MSFT", name: "Microsoft", shares: 4, costBasis: 448.3, price: 471.18 },
    { symbol: "NVDA", name: "NVIDIA", shares: 10, costBasis: 129.75, price: 142.6 },
    { symbol: "AMZN", name: "Amazon", shares: 5, costBasis: 216.4, price: 209.85 },
  ],
};

export const valueHistory: ValuePoint[] = [
  { date: "2026-06-01", value: 10000 },
  { date: "2026-06-05", value: 10038 },
  { date: "2026-06-09", value: 9964 },
  { date: "2026-06-13", value: 10102 },
  { date: "2026-06-17", value: 10187 },
  { date: "2026-06-21", value: 10140 },
  { date: "2026-06-25", value: 10256 },
  { date: "2026-06-29", value: 10231 },
  { date: "2026-07-03", value: 10342 },
  { date: "2026-07-07", value: 10298 },
  { date: "2026-07-11", value: 10410 },
  { date: "2026-07-15", value: 10391 },
  { date: "2026-07-19", value: 10476 },
  { date: "2026-07-23", value: 10458 },
  { date: "2026-07-27", value: 10502 },
  { date: "2026-07-30", value: 10541 },
];

export const safeguards: Safeguards = {
  approvedUniverse: ["AAPL", "MSFT", "NVDA", "AMZN", "AVGO", "VOO", "QQQ"],
  maxPositionPct: 15,
  minCashPct: 10,
  maxOrderPct: 10,
  maxTradesPerDay: 2,
  approvalMode: "approve_each",
  paused: false,
};

export const decisions: Decision[] = [
  {
    id: "dec-014",
    createdAt: "2026-07-30T12:45:00-07:00",
    action: "buy",
    symbol: "AVGO",
    qty: 3,
    estValue: 862.5,
    rationale:
      "Broadcom raised full-year AI networking guidance and the position would bring the AI-infrastructure tilt to its target weight. Two independent evidence items support the move; all safeguards pass.",
    strategyVersion: 3,
    evidence: [
      {
        source: "News — Reuters via Alpaca",
        timestamp: "2026-07-30T09:31:00-07:00",
        summary:
          "Broadcom raises FY guidance on AI networking demand; shares up 2.1% pre-market.",
      },
      {
        source: "Market data — Alpaca bars",
        timestamp: "2026-07-30T12:40:00-07:00",
        summary:
          "AVGO trading above its 50-day average on rising volume; sector ETF confirms the trend.",
      },
    ],
    safeguards: [
      { name: "Watchlist", detail: "AVGO is in the approved watchlist", status: "pass" },
      { name: "Position limit", detail: "Resulting allocation 8.2% ≤ 15% limit", status: "pass" },
      { name: "Cash floor", detail: "Cash after purchase 14.7% ≥ 10% minimum", status: "pass" },
      { name: "Order size", detail: "Order is 8.2% of portfolio ≤ 10% limit", status: "pass" },
      { name: "Trade frequency", detail: "1 of 2 trades used today", status: "pass" },
    ],
    status: "proposed",
  },
  {
    id: "dec-013",
    createdAt: "2026-07-29T10:05:00-07:00",
    action: "buy",
    symbol: "NVDA",
    qty: 12,
    estValue: 1704.0,
    rationale:
      "Proposed adding to NVIDIA after strong data-center results, but the resulting allocation would have exceeded the 15% single-position limit.",
    strategyVersion: 3,
    evidence: [
      {
        source: "News — Alpaca news feed",
        timestamp: "2026-07-29T08:12:00-07:00",
        summary: "NVIDIA data-center revenue beats estimates for the sixth straight quarter.",
      },
    ],
    safeguards: [
      { name: "Watchlist", detail: "NVDA is in the approved watchlist", status: "pass" },
      { name: "Position limit", detail: "Resulting allocation 19.4% > 15% limit", status: "fail" },
      { name: "Cash floor", detail: "Cash after purchase 11.2% ≥ 10% minimum", status: "pass" },
    ],
    status: "blocked",
  },
  {
    id: "dec-012",
    createdAt: "2026-07-28T09:40:00-07:00",
    action: "buy",
    symbol: "MSFT",
    qty: 1,
    estValue: 468.9,
    rationale:
      "Microsoft's cloud growth re-accelerated and the technology tilt was under target. Approved by you and filled through the paper account.",
    strategyVersion: 3,
    evidence: [
      {
        source: "News — Alpaca news feed",
        timestamp: "2026-07-28T06:55:00-07:00",
        summary: "Azure growth re-accelerates to 31% year over year in latest earnings.",
      },
      {
        source: "Market data — Alpaca snapshot",
        timestamp: "2026-07-28T09:35:00-07:00",
        summary: "MSFT holding above prior support after earnings; volatility back to normal range.",
      },
    ],
    safeguards: [
      { name: "Watchlist", detail: "MSFT is in the approved watchlist", status: "pass" },
      { name: "Position limit", detail: "Resulting allocation 13.4% ≤ 15% limit", status: "pass" },
      { name: "Cash floor", detail: "Cash after purchase 18.9% ≥ 10% minimum", status: "pass" },
      { name: "Order size", detail: "Order is 4.4% of portfolio ≤ 10% limit", status: "pass" },
      { name: "Trade frequency", detail: "1 of 2 trades used today", status: "pass" },
    ],
    status: "filled",
    order: {
      id: "ord-8842",
      submittedAt: "2026-07-28T09:52:00-07:00",
      status: "filled",
      filledAt: "2026-07-28T09:52:04-07:00",
      fillPrice: 468.9,
    },
  },
  {
    id: "dec-011",
    createdAt: "2026-07-27T14:20:00-07:00",
    action: "hold",
    rationale:
      "Research cycle found no opportunity that beat holding current positions. Market drifted sideways and no watched company had material news.",
    strategyVersion: 3,
    evidence: [
      {
        source: "Research cycle #41",
        timestamp: "2026-07-27T14:18:00-07:00",
        summary: "Reviewed 7 watchlist symbols; no signal cleared the evidence threshold.",
      },
    ],
    safeguards: [],
    status: "approved",
  },
];

export const activity: ActivityEvent[] = [
  {
    id: "act-101",
    at: "2026-07-30T12:45:00-07:00",
    kind: "proposal",
    title: "Proposed: Buy 3 AVGO (~$862.50)",
    detail: "All 5 safeguards passed. Waiting for your approval.",
  },
  {
    id: "act-100",
    at: "2026-07-30T12:40:00-07:00",
    kind: "research",
    title: "Research cycle #43 completed",
    detail: "Reviewed 7 symbols and 14 news items; 1 opportunity found.",
  },
  {
    id: "act-099",
    at: "2026-07-29T10:05:00-07:00",
    kind: "blocked",
    title: "Blocked: Buy 12 NVDA",
    detail: "Position limit — resulting allocation 19.4% would exceed the 15% cap.",
  },
  {
    id: "act-098",
    at: "2026-07-28T09:52:00-07:00",
    kind: "fill",
    title: "Filled: Buy 1 MSFT @ $468.90",
    detail: "Paper order ord-8842 filled 4 seconds after submission.",
  },
  {
    id: "act-097",
    at: "2026-07-28T09:45:00-07:00",
    kind: "approval",
    title: "You approved: Buy 1 MSFT",
    detail: "Approved from the proposal screen; order submitted to the paper account.",
  },
  {
    id: "act-096",
    at: "2026-07-27T14:20:00-07:00",
    kind: "research",
    title: "Research cycle #41 completed",
    detail: "No action — no signal cleared the evidence threshold.",
  },
  {
    id: "act-095",
    at: "2026-07-27T09:12:00-07:00",
    kind: "profile",
    title: "Investor profile updated to v3",
    detail:
      "You added: “don't trade more than a couple of times a week.” Trade-frequency rule updated.",
  },
  {
    id: "act-094",
    at: "2026-07-26T17:00:00-07:00",
    kind: "summary",
    title: "Weekly summary sent",
    detail:
      "5 research cycles, 12 assets reviewed, 2 trades proposed, 1 filled, 1 blocked. Portfolio +0.8% vs benchmark +1.1%.",
  },
];

export const chatThread: ChatMessage[] = [
  {
    id: "msg-1",
    role: "user",
    text: "Why did you buy Microsoft on Tuesday instead of adding to NVIDIA?",
    at: "2026-07-29T18:02:00-07:00",
  },
  {
    id: "msg-2",
    role: "agent",
    text:
      "Both showed positive signals, but your strategy caps any single position at 15% of the portfolio. NVIDIA was already at 13.9%, so adding 12 shares would have pushed it to 19.4% — the risk engine blocked that order. Microsoft was under its target weight, had two independent pieces of supporting evidence (re-accelerating Azure growth and price holding above post-earnings support), and passed all five safeguards. That made it the better use of available cash under your rules.",
    at: "2026-07-29T18:02:08-07:00",
  },
  {
    id: "msg-3",
    role: "user",
    text: "What would make you change your mind about the AI infrastructure tilt?",
    at: "2026-07-29T18:04:00-07:00",
  },
  {
    id: "msg-4",
    role: "agent",
    text:
      "Three things I'm watching: (1) two consecutive quarters of slowing data-center revenue growth across NVDA, MSFT, and AVGO; (2) guidance cuts on AI capital spending from the large cloud providers; (3) the sector trend breaking below its 200-day average on sustained volume. Any one of those would trigger a strategy review and I'd propose reducing the tilt back toward the VOO core.",
    at: "2026-07-29T18:04:11-07:00",
  },
];

export const cannedReply =
  "In the full version I'll answer this from my decision records — every trade, signal, and safeguard check I've logged. Right now I'm running on sample data while the backend is under construction (Milestone 3).";

export const weeklySummary = {
  period: "Week of Jul 24 – Jul 30, 2026",
  text: "I completed 5 research cycles and reviewed 12 assets. I proposed two trades: one was approved and filled through the paper account (Buy 1 MSFT @ $468.90), and one was blocked because it would have exceeded the 15% position limit (Buy 12 NVDA). The portfolio gained 0.8% during the week, compared with 1.1% for the VOO benchmark. Microsoft was the largest contributor.",
};
