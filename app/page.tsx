"use client";

/* Marketing landing at "/" — FORGE design language (matching lantr.site).
   The product lives behind it under /dashboard etc. */

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
    hub: "Student showcase",
    signIn: "Sign in",
    openApp: "Open the demo",
    openDash: "Open your dashboard",
    badge: "Past Lantr student project · Hosted demo · Paper trading",
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
    hoodKicker: "How the student built it",
    hoodTitle: "From a class idea to a live product.",
    hoodBody:
      "This project was completed by a past Lantr student. The student shipped a small first version, then added the agent, live market tools, risk checks, accounts, and automation one working milestone at a time. Lantr now hosts the finished work for visitors to explore.",
    hoodLink: "Read the source on GitHub",
    whoKicker: "The student's direction",
    whoTitle: "A finance-and-AI project, taken all the way to launch.",
    whoBody:
      "The student chose a question at the intersection of markets, software, and human control—and turned it into working software rather than a presentation.",
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
      "A past Lantr student project, hosted by Lantr for demonstration. Simulated paper trading only. No real money. Not financial advice.",
    footerLinks: "More from Lantr",
  },
  zh: {
    nav: { features: "主要功能", how: "使用流程", who: "作品方向" },
    hub: "往届作品",
    signIn: "登录",
    openApp: "体验作品",
    openDash: "打开投资工作台",
    badge: "Lantr 往届学生作品 · 模拟交易，不涉及真实资金",
    h1: "让 AI 帮你研究市场，买不买仍由你决定。",
    subLead: "告诉它你平时怎么投资，",
    subEm: "它会按你的偏好查看实时行情",
    subRest:
      "、整理交易建议。每一笔订单都会先经过风控规则检查，只有你确认后才会进入模拟账户。",
    ctaPrimary: "开始体验",
    ctaSecondary: "注册体验账户",
    trust: [
      "全程使用模拟资金",
      "每笔订单都先检查风险",
      "没有你的确认不会下单",
    ],
    frameCaption: "学生完成的产品界面：行情研究、持仓管理和模拟交易都集中在同一个工作台。",
    featuresKicker: "学生做了什么",
    featuresTitle: "从了解投资习惯，到提出交易建议，整个流程都做进了产品里。",
    features: [
      {
        t: "先了解你怎么投资",
        b: "用自己的话说明偏好，例如更看重稳健、关注哪些行业、能接受多大波动。产品会把这些信息整理成投资偏好和风控要求。",
      },
      {
        t: "看过行情，再给建议",
        b: "产品会查看实时价格、涨跌、技术指标和新闻，再给出配置建议和不超过五笔的模拟订单，并说明为什么这样判断。",
      },
      {
        t: "风险交给规则检查",
        b: "仓位上限、单笔金额、最低现金比例和低价股限制都写成明确规则。只要不符合要求，建议就不会进入下一步。",
      },
      {
        t: "每笔交易都由你确认",
        b: "你可以同意、调整数量，也可以写下原因拒绝。产品会记住这些选择，下一次研究时作为参考。",
      },
      {
        t: "按时完成例行研究",
        b: "可以设置早间扫描、每周持仓回顾或行业研究。任务会按计划运行，结果准备好后留在工作台里。",
      },
      {
        t: "行情、持仓和自选集中查看",
        b: "涨跌榜、走势图、持仓和自选都在行情页里。打开一只股票后，也可以直接让 AI 接着研究。",
      },
    ],
    howKicker: "实际怎么用",
    howTitle: "从说明偏好到模拟下单，只需四步。",
    how: [
      {
        t: "注册账户",
        b: "系统会准备一个 10 万美元的模拟账户，供你放心体验。",
      },
      {
        t: "说清楚投资偏好",
        b: "通过对话说明关注什么、回避什么，以及能接受的风险。确认无误后再启用。",
      },
      {
        t: "查看研究和建议",
        b: "可以随时发起研究，也可以让任务按计划运行。建议会先经过风控规则检查。",
      },
      {
        t: "确认后再模拟下单",
        b: "同意的订单会进入模拟账户；拒绝时写下的原因，会成为下次研究的参考。",
      },
    ],
    hoodKicker: "作品是怎么完成的",
    hoodTitle: "从第一版网页，一步步做到可以使用。",
    hoodBody:
      "这是一位 Lantr 往届学生完成的项目。学生先做出可以操作的第一版，再逐步加入行情查询、AI 研究、风控规则、用户账户和定时任务。课程结束后，Lantr 继续托管这件作品，供访客体验。",
    hoodLink: "在 GitHub 阅读源码",
    whoKicker: "学生为什么选择这个题目",
    whoTitle: "把对金融市场的兴趣，做成一件能实际操作的作品。",
    whoBody:
      "学生从自己对金融市场的兴趣出发，没有只做一份分析报告，而是把研究、风控和模拟交易写成了一套可以实际操作的软件。",
    who: [
      {
        t: "金融与经济",
        b: "在完整的模拟交易流程中理解投资组合、仓位和风险限制。",
      },
      {
        t: "计算机与人工智能",
        b: "把会查数据、会使用工具的 AI，和普通软件中的明确规则结合起来。",
      },
      {
        t: "数据科学与数学",
        b: "处理市场指标和实时行情，让数据真正参与产品判断。",
      },
    ],
    ctaTitle: "用模拟资金，亲手走一遍完整流程。",
    ctaBody: "使用同一个体验账户，也可以继续查看另外两件往届学生作品。",
    footerDisclaimer:
      "Lantr 往届学生作品，由 Lantr 继续托管。全程使用模拟资金，不涉及真实交易，也不构成投资建议。",
    footerLinks: "更多学生作品",
  },
} as const;

/* A stylized still of the product — the dark workspace inside a window frame. */
function ProductFrame({ lang }: { lang: Lang }) {
  const zh = lang === "zh";
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
            {zh ? "投资组合 · 模拟账户" : "Portfolio · paper"}
          </div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-[#f5f5f3]">
            $103,204.55
          </div>
          <div className="mt-1 text-sm font-medium text-[#00c805]">
            +$3,204.55 (+3.2%) {zh ? "累计" : "all time"}
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
              ["NVDA", zh ? "12 股" : "12 shares", "+4.1%", true],
              ["VOO", zh ? "7 股" : "7 shares", "+1.8%", true],
              ["TSLA", zh ? "5 股" : "5 shares", "−2.3%", false],
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
            {zh ? "新的交易建议 · 来自 AI 分析助手" : "New proposal · from your analyst"}
          </div>
          <div className="mt-3 rounded-xl bg-[#1c1c1c] p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-[#f5f5f3]">
                {zh ? "买入 8 股 MRVL" : "Buy 8 × MRVL"}
              </span>
              <span className="lp-mono text-[12px] text-[#b8b8b4]">≈ $1,140</span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-[#b8b8b4]">
              {zh
                ? "AI 数据中心业务保持增长，符合你偏稳健的科技股方向；买入后，仓位仍低于 15% 的上限。"
                : "AI-datacenter momentum; fits your “cautious tech” tilt without breaching the 15% position cap."}
            </p>
            <ul className="mt-3 space-y-1.5">
              {[
                zh ? "没有超过仓位上限" : "Within position cap",
                zh ? "保留了最低现金比例" : "Cash floor kept",
                zh ? "已上市、流动性充足、股价高于 3 美元" : "Listed, liquid, above $3",
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
                {zh ? "同意" : "Approve"}
              </span>
              <span className="inline-flex flex-1 items-center justify-center rounded-full border border-white/15 px-3 py-1.5 text-[12px] font-medium text-[#b8b8b4]">
                {zh ? "拒绝" : "Reject"}
              </span>
            </div>
          </div>
          <p className="lp-mono mt-3 text-[10px] leading-relaxed text-[#5c5c58]">
            {zh ? "仅供模拟交易，不涉及真实资金。" : "Simulated — paper trading only."}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const [lang, setLang] = useState<Lang>("zh");
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const languageTimer = window.setTimeout(() => {
      const savedLanguage = readLang();
      setLang(savedLanguage);
      document.documentElement.lang = savedLanguage === "zh" ? "zh-CN" : "en";
    }, 0);
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
    });
    return () => window.clearTimeout(languageTimer);
  }, []);

  function switchLang(next: Lang) {
    setLang(next);
    persistLang(next);
    document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
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
              href={lang === "en" ? "https://lantr.site/en" : "https://lantr.site"}
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
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pb-16 pt-16 sm:px-8 sm:pt-20 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12 lg:pb-20">
          <div>
            <Reveal>
              <span className="lp-mono inline-flex items-center gap-2 rounded-full border border-[var(--lp-line-strong)] bg-[var(--lp-surface)] px-4 py-2 text-[11px] font-medium text-[var(--lp-muted)]">
                <span aria-hidden className="size-1.5 rounded-full bg-[var(--lp-accent)]" />
                {c.badge}
              </span>
            </Reveal>
            <h1 className="lp-display mt-7 max-w-3xl text-balance text-[2.6rem] font-normal leading-[1.04] tracking-[-0.02em] text-[var(--lp-fg)] sm:text-[4rem] lg:text-[3.8rem]">
              <Words text={c.h1} delay={120} />
            </h1>
            <Reveal delay={200}>
              <p className="mt-7 max-w-xl text-pretty text-base leading-relaxed text-[var(--lp-muted)] sm:text-lg">
                {c.subLead}
                <em className="lp-display italic text-[var(--lp-ink)]">{c.subEm}</em>
                {c.subRest}
              </p>
            </Reveal>
            <Reveal delay={280}>
              <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row">
                <Link href="/dashboard" className="lp-btn h-12 px-6 text-[15px]">
                  {c.ctaPrimary} →
                </Link>
                <Link href="/signin" className="lp-btn-ghost h-12 px-6 text-[15px]">
                  {c.ctaSecondary}
                </Link>
              </div>
            </Reveal>
            <Reveal delay={360}>
              <div className="mt-8 grid gap-2 text-[13px] text-[var(--lp-muted)]">
                {c.trust.map((t) => (
                  <span key={t} className="flex items-center gap-2">
                    <span aria-hidden className="h-1 w-1 rounded-full bg-[var(--lp-accent)]" />
                    {t}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>
          <Reveal delay={360} className="min-w-0 lg:-mr-14">
            <ProductFrame lang={lang} />
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
                    <a
                      href={lang === "en" ? "https://lantr.site/en" : "https://lantr.site"}
                      className="hover:text-[var(--lp-fg)]"
                    >
                      lantr.site — {lang === "en" ? "student showcase" : "学生作品展"}
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
