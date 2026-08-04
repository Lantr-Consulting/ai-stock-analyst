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
    "我更关注大型科技公司，可以接受中等程度的波动。",
    "我认为未来几年 AI 基础设施仍会继续增长。",
    "投资组合中要保留一部分宽基指数基金，每周新增交易不要超过两笔。",
  ],
  goals: "在了解市场运作方式的同时，建立长期投资组合",
  riskTolerance: "moderate",
  timeHorizon: "3—5 年",
  preferredSectors: ["科技", "AI 基础设施", "宽基指数 ETF"],
  avoid: ["低价股", "期权、融资融券和加密资产（不在本项目范围内）"],
  marketViews: [
    "AI 基础设施需求仍在增长",
    "相比投机性股票，更偏好已经盈利的大型公司",
  ],
  tradingFrequency: "每周最多新增 2 笔交易",
};

export const strategy: Strategy = {
  version: 3,
  updatedAt: "2026-07-27T09:12:00-07:00",
  summary:
    "以宽基指数基金作为核心仓位，适度增加大型科技公司和 AI 基础设施方向；只在有充分依据时调整仓位，并保留现金应对市场回调。",
  watching: [
    "AI 基础设施公司的财报和业绩指引（NVDA、MSFT、AVGO）",
    "大盘走势和 VOO 基准的对比",
    "可能改变现有持仓判断的重要新闻",
  ],
  rules: [
    "核心仓位：VOO 保持在投资组合的 30%—50%",
    "单只科技股仓位不超过 15%",
    "至少有两项相互独立的依据时，才提出买入建议",
    "任何时候至少保留 10% 现金",
    "只提出建议，不自动执行；每笔订单都需要用户确认",
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
      "Broadcom 上调了全年 AI 网络业务指引，这笔交易可以让 AI 基础设施方向接近目标仓位。两项相互独立的依据支持买入，所有风控检查均已通过。",
    strategyVersion: 3,
    evidence: [
      {
        source: "新闻 — Alpaca 提供的 Reuters 内容",
        timestamp: "2026-07-30T09:31:00-07:00",
        summary:
          "Broadcom 因 AI 网络需求上调全年指引，盘前上涨 2.1%。",
      },
      {
        source: "行情数据 — Alpaca K 线",
        timestamp: "2026-07-30T12:40:00-07:00",
        summary:
          "AVGO 放量站上 50 日均线，相关行业 ETF 也呈现相同趋势。",
      },
    ],
    safeguards: [
      { name: "自选范围", detail: "AVGO 在已确认的自选范围内", status: "pass" },
      { name: "仓位上限", detail: "买入后仓位为 8.2%，没有超过 15% 上限", status: "pass" },
      { name: "最低现金", detail: "买入后现金占比 14.7%，高于 10% 下限", status: "pass" },
      { name: "单笔金额", detail: "订单占投资组合 8.2%，没有超过 10% 上限", status: "pass" },
      { name: "交易次数", detail: "今天已使用 2 次上限中的 1 次", status: "pass" },
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
      "NVIDIA 数据中心业务表现强劲，因此提出加仓建议；但买入后单只股票仓位会超过 15% 上限。",
    strategyVersion: 3,
    evidence: [
      {
        source: "新闻 — Alpaca 新闻流",
        timestamp: "2026-07-29T08:12:00-07:00",
        summary: "NVIDIA 数据中心收入连续第六个季度超过市场预期。",
      },
    ],
    safeguards: [
      { name: "自选范围", detail: "NVDA 在已确认的自选范围内", status: "pass" },
      { name: "仓位上限", detail: "买入后仓位为 19.4%，超过 15% 上限", status: "fail" },
      { name: "最低现金", detail: "买入后现金占比 11.2%，高于 10% 下限", status: "pass" },
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
      "Microsoft 云业务增长重新加速，而科技股仓位低于目标。这笔订单经用户确认后，已经在模拟账户成交。",
    strategyVersion: 3,
    evidence: [
      {
        source: "新闻 — Alpaca 新闻流",
        timestamp: "2026-07-28T06:55:00-07:00",
        summary: "最新财报显示，Azure 同比增速重新提高到 31%。",
      },
      {
        source: "行情数据 — Alpaca 快照",
        timestamp: "2026-07-28T09:35:00-07:00",
        summary: "财报发布后，MSFT 仍处于前期支撑位上方，波动率也回到正常范围。",
      },
    ],
    safeguards: [
      { name: "自选范围", detail: "MSFT 在已确认的自选范围内", status: "pass" },
      { name: "仓位上限", detail: "买入后仓位为 13.4%，没有超过 15% 上限", status: "pass" },
      { name: "最低现金", detail: "买入后现金占比 18.9%，高于 10% 下限", status: "pass" },
      { name: "单笔金额", detail: "订单占投资组合 4.4%，没有超过 10% 上限", status: "pass" },
      { name: "交易次数", detail: "今天已使用 2 次上限中的 1 次", status: "pass" },
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
      "本轮研究没有发现比继续持有更合适的机会。市场整体横盘，自选范围内也没有出现足以改变判断的重要新闻。",
    strategyVersion: 3,
    evidence: [
      {
        source: "第 41 次研究",
        timestamp: "2026-07-27T14:18:00-07:00",
        summary: "查看了 7 只自选股票，没有发现达到依据要求的信号。",
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
    title: "建议：买入 3 股 AVGO（约 862.50 美元）",
    detail: "5 项风控检查全部通过，正在等待用户确认。",
  },
  {
    id: "act-100",
    at: "2026-07-30T12:40:00-07:00",
    kind: "research",
    title: "第 43 次研究已经完成",
    detail: "查看了 7 只股票和 14 条新闻，发现 1 个可能的机会。",
  },
  {
    id: "act-099",
    at: "2026-07-29T10:05:00-07:00",
    kind: "blocked",
    title: "未通过风控：买入 12 股 NVDA",
    detail: "仓位上限：买入后占比将达到 19.4%，超过 15% 上限。",
  },
  {
    id: "act-098",
    at: "2026-07-28T09:52:00-07:00",
    kind: "fill",
    title: "已成交：以 468.90 美元买入 1 股 MSFT",
    detail: "模拟订单 ord-8842 提交 4 秒后成交。",
  },
  {
    id: "act-097",
    at: "2026-07-28T09:45:00-07:00",
    kind: "approval",
    title: "你已确认：买入 1 股 MSFT",
    detail: "用户在交易建议页面确认后，订单提交到模拟账户。",
  },
  {
    id: "act-096",
    at: "2026-07-27T14:20:00-07:00",
    kind: "research",
    title: "第 41 次研究已经完成",
    detail: "不进行交易：没有信号达到依据要求。",
  },
  {
    id: "act-095",
    at: "2026-07-27T09:12:00-07:00",
    kind: "profile",
    title: "投资偏好已更新到 v3",
    detail:
      "你新增了“每周交易不要超过两笔”，交易次数限制已经更新。",
  },
  {
    id: "act-094",
    at: "2026-07-26T17:00:00-07:00",
    kind: "summary",
    title: "每周回顾已经生成",
    detail:
      "完成 5 次研究，查看 12 只股票，提出 2 笔交易建议；其中 1 笔成交、1 笔未通过风控。投资组合上涨 0.8%，基准上涨 1.1%。",
  },
];

export const chatThread: ChatMessage[] = [
  {
    id: "msg-1",
    role: "user",
    text: "为什么周二买了 Microsoft，而不是继续加仓 NVIDIA？",
    at: "2026-07-29T18:02:00-07:00",
  },
  {
    id: "msg-2",
    role: "agent",
    text:
      "两只股票都出现了积极信号，但你的规则要求单只股票仓位不超过投资组合的 15%。NVIDIA 原本已经占 13.9%，再买 12 股会提高到 19.4%，因此没有通过风控。Microsoft 低于目标仓位，并且有两项相互独立的依据：Azure 增长重新加速，以及财报后股价仍处于支撑位上方。它也通过了全部五项风控检查，所以在你的规则下，更适合使用当前现金。",
    at: "2026-07-29T18:02:08-07:00",
  },
  {
    id: "msg-3",
    role: "user",
    text: "什么情况会让你改变对 AI 基础设施方向的判断？",
    at: "2026-07-29T18:04:00-07:00",
  },
  {
    id: "msg-4",
    role: "agent",
    text:
      "我在关注三件事：第一，NVDA、MSFT 和 AVGO 的数据中心收入增速连续两个季度放缓；第二，大型云服务商下调 AI 资本开支指引；第三，相关行业在持续放量的情况下跌破 200 日均线。只要出现其中一种情况，就会触发策略复查；届时我会建议降低这一方向的仓位，并增加 VOO 核心仓位。",
    at: "2026-07-29T18:04:11-07:00",
  },
];

export const cannedReply =
  "完整版本会根据已经记录的交易、信号和风控检查回答这个问题。当前显示的是演示数据。";

export const weeklySummary = {
  period: "2026 年 7 月 24—30 日",
  text: "本周完成了 5 次研究，共查看 12 只股票，并提出两笔交易建议。其中一笔经用户确认后在模拟账户成交（以 468.90 美元买入 1 股 MSFT）；另一笔因为会超过 15% 仓位上限而没有通过风控（买入 12 股 NVDA）。本周投资组合上涨 0.8%，VOO 基准上涨 1.1%；Microsoft 是贡献最大的持仓。",
};
