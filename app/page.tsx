"use client";

/* Marketing landing at "/" — FORGE design language (matching lantr.site),
   bilingual EN/中文. The product lives behind it under /dashboard etc. */

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  ColumnRules,
  LangToggle,
  persistLang,
  readLang,
  Reveal,
  Words,
  type Lang,
} from "@/components/landing/kit";

const COPY = {
  en: {
    nav: { features: "Features", how: "How it works", who: "Who it's for" },
    hub: "All demos",
    signIn: "Sign in",
    openApp: "Open the demo",
    openDash: "Open your dashboard",
    badge: "A Lantr sample project · Simulated paper trading",
    h1: "A personal AI analyst that manages your portfolio.",
    subLead: "Describe how you invest in plain English. ",
    subEm: "It does the analyst's work",
    subRest:
      " — researching the live market, proposing trades inside your safeguards, and executing only what you approve, on a $100k paper-trading account.",
    ctaPrimary: "Explore the live demo",
    ctaSecondary: "Create a free account",
    trust: [
      "Paper trading only — no real money",
      "A deterministic risk engine checks every order",
      "Nothing executes without your approval",
    ],
    frameCaption:
      "The product: a dark, Robinhood-style workspace on real market data.",
    featuresKicker: "What it does",
    featuresTitle: "An analyst, not an autocomplete.",
    features: [
      {
        t: "A strategy in your own words",
        b: "Tell it “cautious tech investor, prefers dividends, no meme stocks.” The agent turns that into a working investor profile it actually follows — and updates it when you change your mind in chat.",
      },
      {
        t: "Research on live markets",
        b: "It screens real movers, reads indicators — SMA, RSI, volatility, drawdown — and news, then returns a target allocation and up to five sized orders with reasoning you can interrogate.",
      },
      {
        t: "Code decides, the model narrates",
        b: "Position caps, order limits, cash floors, penny-stock filters — enforced by a deterministic risk engine, not by the LLM. A proposal that breaks your limits never reaches you.",
      },
      {
        t: "You hold the trigger",
        b: "Every order arrives as a ticket: approve it, resize it, or reject it with a reason. Your verdicts become lessons the analyst reads before its next research cycle.",
      },
      {
        t: "Missions that run without you",
        b: "Standing automations on a schedule — a morning scan, a weekly portfolio review, a sector deep-dive. Reports land in your workspace, ready when you are.",
      },
      {
        t: "A market you can wander",
        b: "A live Discover tab: top movers with sparklines, your holdings and watchlist, and a full ticker page for any US stock — one tap sends it to your analyst.",
      },
    ],
    howKicker: "How it works",
    howTitle: "Four steps, one loop.",
    how: [
      {
        t: "Create an account",
        b: "You get a fresh $100k Alpaca paper-trading account and a blank analyst.",
      },
      {
        t: "Interview your analyst",
        b: "Describe yourself in chat. It drafts your investor profile and safeguards; nothing activates until you approve.",
      },
      {
        t: "It researches and proposes",
        b: "On demand or on schedule, it studies the market and files safeguard-checked trade proposals.",
      },
      {
        t: "You approve, it learns",
        b: "Approved orders go to the paper account; rejections become lessons. The loop repeats, a little smarter each time.",
      },
    ],
    hoodKicker: "Under the hood",
    hoodTitle: "Built milestone by milestone.",
    hoodBody:
      "First ship, design pass, brain, hands, memory, autonomy — built in the exact order Lantr students build theirs, with every milestone a public tag on GitHub.",
    hoodLink: "Read the source on GitHub",
    whoKicker: "Who it's for",
    whoTitle: "The finance & quant track sample.",
    whoBody:
      "Lantr students build a project aimed at their intended major. This one shows what the finance-and-markets direction looks like when it ships.",
    who: [
      {
        t: "Finance & Economics",
        b: "Portfolio construction, risk limits, and market microstructure — implemented in code, not just described in an essay.",
      },
      {
        t: "Computer Science & AI",
        b: "A tool-using LLM agent with memory, feedback loops, and a deterministic guardrail layer — the architecture serious AI products use.",
      },
      {
        t: "Data Science & Math",
        b: "Indicators, screeners, evaluation loops, and a live data pipeline from market APIs to decisions.",
      },
    ],
    ctaTitle: "Try it with simulated money. Keep the lessons.",
    ctaBody: "Sign in once and you're signed in across every Lantr demo.",
    footerDisclaimer:
      "Simulated paper trading only. No real money. Not financial advice. Built as a Lantr sample project.",
    footerLinks: "More from Lantr",
  },
  zh: {
    nav: { features: "功能", how: "运作方式", who: "适合谁" },
    hub: "全部演示",
    signIn: "登录",
    openApp: "进入演示",
    openDash: "打开我的工作台",
    badge: "Lantr 示范项目 · 模拟盘交易",
    h1: "一位专属于你的 AI 股票分析师。",
    subLead: "用一句话描述你的投资风格，",
    subEm: "剩下的交给它",
    subRest:
      "——研究实时行情、在你的风控范围内提出交易建议，经你批准后在 10 万美元模拟账户中执行。",
    ctaPrimary: "进入在线演示",
    ctaSecondary: "免费创建账户",
    trust: [
      "仅模拟盘交易 — 不涉及真实资金",
      "每笔订单都经过确定性风控引擎检查",
      "未经你批准，绝不下单",
    ],
    frameCaption: "产品实况：深色 Robinhood 风格工作台，接入真实行情数据。",
    featuresKicker: "它能做什么",
    featuresTitle: "是分析师，不是自动补全。",
    features: [
      {
        t: "用你自己的话定策略",
        b: "告诉它“稳健的科技股投资者，偏好分红，不碰梗股”，它会把这句话变成一份真正执行的投资档案；你在对话中改了主意，它随时更新。",
      },
      {
        t: "基于实时行情的研究",
        b: "它扫描真实市场异动，阅读 SMA、RSI、波动率、回撤等指标和新闻，给出目标配置和至多五笔带仓位的订单建议——每一条理由都经得起追问。",
      },
      {
        t: "代码做决定，模型做解释",
        b: "仓位上限、单笔限额、现金底线、仙股过滤——全部由确定性风控引擎执行，而不是靠大模型自觉。任何越界的提案都到不了你面前。",
      },
      {
        t: "最终决定权在你手里",
        b: "每笔订单都是一张待批的交易单：批准、改仓位、或写明理由拒绝。你的每次判断都会成为分析师下一轮研究前必读的经验。",
      },
      {
        t: "你不在时，它照常工作",
        b: "定时执行的常设任务——早间扫描、每周组合回顾、行业深挖。报告自动生成，等你上线时已经在工作台里等你。",
      },
      {
        t: "可以随便逛的市场页",
        b: "实时 Discover 页：涨跌榜与迷你走势图、你的持仓与自选，任意美股的完整个股页——一键把它交给你的分析师研究。",
      },
    ],
    howKicker: "运作方式",
    howTitle: "四个步骤，一个闭环。",
    how: [
      {
        t: "创建账户",
        b: "你会得到一个全新的 10 万美元 Alpaca 模拟账户，和一位空白的分析师。",
      },
      {
        t: "和分析师“面谈”",
        b: "在对话中介绍你自己。它起草你的投资档案与风控参数，经你确认后才会激活。",
      },
      {
        t: "它研究并提案",
        b: "按需或按计划，它研究市场并提交已通过风控检查的交易提案。",
      },
      {
        t: "你批准，它学习",
        b: "批准的订单进入模拟账户，拒绝的理由变成经验。循环往复，每一轮都更懂你。",
      },
    ],
    hoodKicker: "技术底层",
    hoodTitle: "按里程碑逐步构建。",
    hoodBody:
      "首次上线、设计打磨、大脑、双手、记忆、自主运行——与 Lantr 学员的构建路径完全一致，每个里程碑都是 GitHub 上公开的 tag。",
    hoodLink: "在 GitHub 阅读源码",
    whoKicker: "适合谁",
    whoTitle: "金融与量化方向的示范作品。",
    whoBody:
      "Lantr 学员会围绕自己的目标专业打造项目。这个项目展示了金融与市场方向做出来是什么样子。",
    who: [
      {
        t: "金融与经济",
        b: "组合构建、风险限额、市场微观结构——不是文书里的一句话，而是真正写成了代码。",
      },
      {
        t: "计算机与人工智能",
        b: "一个会调用工具的 LLM 智能体：记忆、反馈闭环、确定性护栏层——正经 AI 产品的架构。",
      },
      {
        t: "数据科学与数学",
        b: "指标、选股器、评估闭环，以及从行情 API 到交易决策的实时数据管线。",
      },
    ],
    ctaTitle: "用模拟资金试一试，把经验留下。",
    ctaBody: "登录一次，即可通行所有 Lantr 演示项目。",
    footerDisclaimer:
      "仅为模拟盘交易，不涉及真实资金，不构成投资建议。Lantr 示范项目。",
    footerLinks: "更多 Lantr 项目",
  },
} as const;

/* A stylized still of the product — the dark workspace inside a window frame. */
function ProductFrame() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--lp-line-strong)] bg-[#0b0b0b] text-left shadow-[0_1px_2px_rgba(30,28,23,0.06),0_40px_80px_-40px_rgba(30,28,23,0.4)]">
      {/* window chrome */}
      <div className="flex items-center gap-1.5 border-b border-white/[0.07] px-4 py-3">
        <span className="size-2.5 rounded-full bg-[#3a3a38]" />
        <span className="size-2.5 rounded-full bg-[#3a3a38]" />
        <span className="size-2.5 rounded-full bg-[#3a3a38]" />
        <span className="lp-mono ml-3 text-[11px] text-[#7d7d78]">
          analyst.lantr.site
        </span>
      </div>
      <div className="grid gap-px bg-white/[0.06] md:grid-cols-[1.4fr_1fr]">
        {/* portfolio pane */}
        <div className="bg-[#0b0b0b] p-5 sm:p-6">
          <div className="lp-mono text-[10px] uppercase tracking-[0.14em] text-[#7d7d78]">
            Portfolio · paper
          </div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-[#f5f5f3]">
            $103,204.55
          </div>
          <div className="mt-1 text-sm font-medium text-[#00c805]">
            +$3,204.55 (+3.2%) all time
          </div>
          <svg
            viewBox="0 0 300 80"
            className="mt-4 h-20 w-full"
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <linearGradient id="lpspark" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00c805" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#00c805" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0,62 C25,58 45,66 70,55 S115,40 140,44 S185,28 215,30 S265,14 300,10 L300,80 L0,80 Z"
              fill="url(#lpspark)"
            />
            <path
              d="M0,62 C25,58 45,66 70,55 S115,40 140,44 S185,28 215,30 S265,14 300,10"
              fill="none"
              stroke="#00c805"
              strokeWidth="2"
            />
          </svg>
          <div className="mt-4 space-y-2.5">
            {[
              ["NVDA", "12 shares", "+4.1%", true],
              ["VOO", "7 shares", "+1.8%", true],
              ["TSLA", "5 shares", "−2.3%", false],
            ].map(([sym, qty, chg, up]) => (
              <div
                key={sym as string}
                className="flex items-center justify-between text-sm"
              >
                <span className="font-medium text-[#f5f5f3]">{sym}</span>
                <span className="text-[#7d7d78]">{qty}</span>
                <span
                  className={`lp-mono text-[13px] ${up ? "text-[#00c805]" : "text-[#ff5000]"}`}
                >
                  {chg}
                </span>
              </div>
            ))}
          </div>
        </div>
        {/* proposal pane */}
        <div className="bg-[#131313] p-5 sm:p-6">
          <div className="lp-mono text-[10px] uppercase tracking-[0.14em] text-[#7d7d78]">
            New proposal · from your analyst
          </div>
          <div className="mt-3 rounded-xl bg-[#1c1c1c] p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-[#f5f5f3]">
                Buy 8 × MRVL
              </span>
              <span className="lp-mono text-[12px] text-[#b8b8b4]">≈ $1,140</span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-[#b8b8b4]">
              AI-datacenter momentum; fits your “cautious tech” tilt without
              breaching the 15% position cap.
            </p>
            <ul className="mt-3 space-y-1.5">
              {[
                "Within position cap",
                "Cash floor kept",
                "Listed, liquid, above $3",
              ].map((c) => (
                <li
                  key={c}
                  className="flex items-center gap-2 text-[11px] text-[#7d7d78]"
                >
                  <svg
                    viewBox="0 0 12 12"
                    className="size-3 text-[#00c805]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M2 6.5 4.5 9 10 3.5" />
                  </svg>
                  {c}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <span className="inline-flex flex-1 items-center justify-center rounded-full bg-[#ccf72e] px-3 py-1.5 text-[12px] font-semibold text-black">
                Approve
              </span>
              <span className="inline-flex flex-1 items-center justify-center rounded-full border border-white/15 px-3 py-1.5 text-[12px] font-medium text-[#b8b8b4]">
                Reject
              </span>
            </div>
          </div>
          <p className="lp-mono mt-3 text-[10px] leading-relaxed text-[#5c5c58]">
            Simulated — paper trading only.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const [lang, setLang] = useState<Lang>("en");
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setLang(readLang());
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
    });
  }, []);

  function switchLang(l: Lang) {
    setLang(l);
    persistLang(l);
  }

  const c = COPY[lang];

  return (
    <div className="forge min-h-screen">
      {/* ── nav ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-[var(--lp-line)] bg-[color-mix(in_oklab,var(--lp-bg)_86%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-5 px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--lp-gold)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/lantr_mark.png" alt="Lantr" className="size-4.5" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-[var(--lp-fg)]">
              AI Stock Analyst
            </span>
          </Link>
          <nav className="ml-4 hidden items-center gap-5 text-sm text-[var(--lp-muted)] md:flex">
            <a href="#features" className="transition-colors hover:text-[var(--lp-fg)]">
              {c.nav.features}
            </a>
            <a href="#how" className="transition-colors hover:text-[var(--lp-fg)]">
              {c.nav.how}
            </a>
            <a href="#who" className="transition-colors hover:text-[var(--lp-fg)]">
              {c.nav.who}
            </a>
            <a
              href="https://lantr.site"
              className="transition-colors hover:text-[var(--lp-fg)]"
            >
              {c.hub} ↗
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2.5">
            <LangToggle lang={lang} onChange={switchLang} />
            {signedIn ? (
              <Link
                href="/dashboard"
                className="lp-btn h-9 px-4 text-[13px]"
              >
                {c.openDash}
              </Link>
            ) : (
              <>
                <Link
                  href="/signin"
                  className="lp-btn-ghost hidden h-9 px-4 text-[13px] sm:inline-flex"
                >
                  {c.signIn}
                </Link>
                <Link href="/dashboard" className="lp-btn h-9 px-4 text-[13px]">
                  {c.openApp}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <ColumnRules />
        <div className="relative mx-auto w-full max-w-6xl px-5 pb-16 pt-16 text-center sm:px-8 sm:pt-24">
          <Reveal>
            <span className="lp-mono inline-flex items-center gap-2 rounded-full border border-[var(--lp-line-strong)] bg-[var(--lp-surface)] px-4 py-2 text-[11px] font-medium text-[var(--lp-muted)]">
              <span aria-hidden className="size-1.5 rounded-full bg-[var(--lp-accent)]" />
              {c.badge}
            </span>
          </Reveal>
          <h1 className="lp-display mx-auto mt-7 max-w-3xl text-balance text-[2.5rem] font-normal leading-[1.07] tracking-[-0.015em] text-[var(--lp-fg)] sm:text-[3.9rem]">
            <Words text={c.h1} delay={120} />
          </h1>
          <Reveal delay={200}>
            <p className="mx-auto mt-7 max-w-2xl text-pretty text-base leading-relaxed text-[var(--lp-muted)] sm:text-lg">
              {c.subLead}
              <em className="lp-display italic text-[var(--lp-ink)]">{c.subEm}</em>
              {c.subRest}
            </p>
          </Reveal>
          <Reveal delay={280}>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/dashboard" className="lp-btn h-12 px-6 text-[15px]">
                {c.ctaPrimary} →
              </Link>
              <Link href="/signin" className="lp-btn-ghost h-12 px-6 text-[15px]">
                {c.ctaSecondary}
              </Link>
            </div>
          </Reveal>
          <Reveal delay={360}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-[13px] text-[var(--lp-muted)]">
              {c.trust.map((t) => (
                <span key={t} className="flex items-center gap-2">
                  <span aria-hidden className="h-1 w-1 rounded-full bg-[var(--lp-accent)]" />
                  {t}
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal delay={440} className="mx-auto mt-12 max-w-4xl">
            <ProductFrame />
            <p className="lp-mono mt-3 text-[11px] text-[var(--lp-faint)]">
              {c.frameCaption}
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── features ─────────────────────────────────────── */}
      <section id="features" className="border-t border-[var(--lp-line)] bg-[var(--lp-bg2)]">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
          <Reveal>
            <div className="lp-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--lp-accent)]">
              {c.featuresKicker}
            </div>
            <h2 className="lp-display mt-3 max-w-xl text-3xl font-normal tracking-tight text-[var(--lp-fg)] sm:text-4xl">
              {c.featuresTitle}
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.features.map((f, i) => (
              <Reveal key={f.t} delay={i * 70}>
                <div className="lp-card lp-lift h-full rounded-2xl p-6">
                  <div className="lp-mono text-[11px] text-[var(--lp-faint)]">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="mt-3 text-[15px] font-semibold tracking-tight text-[var(--lp-fg)]">
                    {f.t}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--lp-muted)]">
                    {f.b}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── how it works ─────────────────────────────────── */}
      <section id="how" className="border-t border-[var(--lp-line)]">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
          <Reveal>
            <div className="lp-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--lp-accent)]">
              {c.howKicker}
            </div>
            <h2 className="lp-display mt-3 text-3xl font-normal tracking-tight text-[var(--lp-fg)] sm:text-4xl">
              {c.howTitle}
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {c.how.map((s, i) => (
              <Reveal key={s.t} delay={i * 90}>
                <div className="relative h-full rounded-2xl border border-[var(--lp-line)] bg-[var(--lp-surface)] p-6">
                  <div className="lp-display text-3xl italic text-[var(--lp-accent)]">
                    {i + 1}
                  </div>
                  <h3 className="mt-3 text-[15px] font-semibold tracking-tight text-[var(--lp-fg)]">
                    {s.t}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--lp-muted)]">
                    {s.b}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* under the hood strip */}
          <Reveal delay={120}>
            <div className="lp-card mt-12 rounded-2xl p-7 sm:p-9">
              <div className="lp-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--lp-accent)]">
                {c.hoodKicker}
              </div>
              <div className="mt-3 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                <div className="max-w-xl">
                  <h3 className="lp-display text-2xl font-normal tracking-tight text-[var(--lp-fg)]">
                    {c.hoodTitle}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--lp-muted)]">
                    {c.hoodBody}
                  </p>
                  <a
                    href="https://github.com/Lantr-Consulting/ai-stock-analyst"
                    className="mt-3 inline-block text-sm font-medium text-[var(--lp-accent)] hover:text-[var(--lp-accent-ink)]"
                  >
                    {c.hoodLink} →
                  </a>
                </div>
                <div className="flex max-w-sm flex-wrap gap-1.5">
                  {[
                    "Next.js",
                    "Tailwind",
                    "FastAPI",
                    "LangChain",
                    "DeepSeek",
                    "Alpaca Paper API",
                    "Supabase",
                    "Railway",
                    "Vercel",
                  ].map((t) => (
                    <span
                      key={t}
                      className="lp-mono rounded-full border border-[var(--lp-line-strong)] px-3 py-1 text-[11px] text-[var(--lp-muted)]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── who it's for ─────────────────────────────────── */}
      <section id="who" className="border-t border-[var(--lp-line)] bg-[var(--lp-bg2)]">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
          <Reveal>
            <div className="lp-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--lp-accent)]">
              {c.whoKicker}
            </div>
            <h2 className="lp-display mt-3 text-3xl font-normal tracking-tight text-[var(--lp-fg)] sm:text-4xl">
              {c.whoTitle}
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--lp-muted)]">
              {c.whoBody}
            </p>
          </Reveal>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {c.who.map((w, i) => (
              <Reveal key={w.t} delay={i * 90}>
                <div className="lp-card lp-lift h-full rounded-2xl border-t-2 border-t-[var(--lp-accent)] p-6">
                  <h3 className="text-[15px] font-semibold tracking-tight text-[var(--lp-fg)]">
                    {w.t}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--lp-muted)]">
                    {w.b}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── final CTA + footer (the single dark band) ────── */}
      <section className="lp-scene">
        <div className="mx-auto w-full max-w-6xl px-5 pb-10 pt-20 sm:px-8">
          <div className="text-center">
            <Reveal>
              <h2 className="lp-display mx-auto max-w-2xl text-balance text-3xl font-normal tracking-tight text-[var(--lp-fg)] sm:text-4xl">
                {c.ctaTitle}
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--lp-muted)]">
                {c.ctaBody}
              </p>
            </Reveal>
            <Reveal delay={140}>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/dashboard" className="lp-btn h-12 px-6 text-[15px]">
                  {c.ctaPrimary} →
                </Link>
                <Link
                  href="/signin"
                  className="lp-btn-ghost h-12 border-[var(--lp-line-strong)] bg-transparent px-6 text-[15px] text-[var(--lp-fg)]"
                >
                  {c.ctaSecondary}
                </Link>
              </div>
            </Reveal>
          </div>
          <footer className="mt-16 border-t border-[var(--lp-line)] pt-8">
            <div className="flex flex-col justify-between gap-6 md:flex-row">
              <div className="max-w-md">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-[var(--lp-gold)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/lantr_mark.png" alt="Lantr" className="size-4" />
                  </span>
                  <span className="text-sm font-semibold text-[var(--lp-fg)]">
                    AI Stock Analyst
                  </span>
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-[var(--lp-faint)]">
                  {c.footerDisclaimer}
                </p>
              </div>
              <div>
                <div className="lp-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--lp-faint)]">
                  {c.footerLinks}
                </div>
                <ul className="mt-3 space-y-1.5 text-[13px] text-[var(--lp-muted)]">
                  <li>
                    <a href="https://lantr.site" className="hover:text-[var(--lp-fg)]">
                      lantr.site — demo hub
                    </a>
                  </li>
                  <li>
                    <a href="https://airaware.lantr.site" className="hover:text-[var(--lp-fg)]">
                      AirAware
                    </a>
                  </li>
                  <li>
                    <a href="https://postpilot.lantr.site" className="hover:text-[var(--lp-fg)]">
                      PostPilot
                    </a>
                  </li>
                  <li>
                    <a href="https://lantr.ai" className="hover:text-[var(--lp-fg)]">
                      lantr.ai
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://github.com/Lantr-Consulting/ai-stock-analyst"
                      className="hover:text-[var(--lp-fg)]"
                    >
                      GitHub
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </footer>
        </div>
      </section>
    </div>
  );
}
