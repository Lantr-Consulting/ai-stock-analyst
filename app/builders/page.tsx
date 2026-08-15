import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Lantr Builders — Build what the AI era demands",
  description:
    "A personalized AI builder school for ambitious students. Learn by shipping real products with a curriculum shaped around you.",
  robots: {
    index: false,
    follow: false,
  },
};

const GET_STARTED = "https://lantr.ai/get-started";

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={styles.arrow}
      fill="none"
    >
      <path
        d={diagonal ? "M4 12 12 4M6 4h6v6" : "M3 8h10M9 4l4 4-4 4"}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function Check() {
  return (
    <span className={styles.check} aria-hidden="true">
      <svg viewBox="0 0 12 12" fill="none">
        <path
          d="m2.5 6.2 2.1 2.1 4.9-5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    </span>
  );
}

function Brand() {
  return (
    <span className={styles.brand}>
      <span className={styles.mark}>
        <Image src="/lantr_mark.png" width={20} height={20} alt="" priority />
      </span>
      <span>Lantr</span>
      <span className={styles.brandTag}>Builders</span>
    </span>
  );
}

const programs = [
  {
    eyebrow: "Start here",
    name: "Project Pack",
    price: "$490",
    suffix: "one time",
    description:
      "A proven build architecture, adapted to a student’s interests—not a cookie-cutter final project.",
    features: [
      "6-week adaptive build path",
      "Choice of project architecture",
      "Lantr Builder Copilot",
      "Weekly open build lab",
      "3 months of Builder Club",
    ],
    cta: "Choose a Project Pack",
  },
  {
    eyebrow: "Build together",
    name: "Builder Studio",
    price: "$2,400",
    suffix: "per cohort",
    description:
      "A small, guided studio for students who want human review, accountability, and a stronger launch.",
    features: [
      "8-week small-group studio",
      "Personalized project direction",
      "Weekly mentor reviews",
      "User testing + public demo day",
      "6 months of Builder Club",
    ],
    cta: "Join the next studio",
  },
  {
    eyebrow: "Flagship",
    name: "Founder Fellowship",
    price: "$8,000",
    suffix: "12-month experience",
    description:
      "A founder- and advisor-designed path from ambitious idea to a product with real users and a life after launch.",
    features: [
      "1:1 founder diagnostic + roadmap",
      "8-week private build intensive",
      "Launch and impact support",
      "Advisor access where there is fit",
      "12 months of the Lantr ecosystem",
    ],
    cta: "Apply for the Fellowship",
    featured: true,
  },
];

const faqs = [
  {
    question: "Does my child need to know how to code?",
    answer:
      "No. We calibrate the starting point to the student. They learn technical concepts when those concepts become necessary to make, debug, and ship their product—not through months of disconnected exercises.",
  },
  {
    question: "Is AI doing the work for the student?",
    answer:
      "AI is part of the toolchain, not a substitute for ownership. Students must make product decisions, test outputs, debug failures, speak to users, and explain how their systems work. The standard is a product they understand and can defend.",
  },
  {
    question: "Are these all the same template project?",
    answer:
      "No. Project Packs provide a proven technical architecture so beginners can get moving. Each student changes the problem, audience, data, product behavior, design, and launch. Fellowship projects are designed from the ground up around the student.",
  },
  {
    question: "What happens after the eight-week intensive?",
    answer:
      "Students keep their product, portfolio, and community access. Depending on the program, they also receive Builder Copilot access, monthly build rooms, project reviews, launch opportunities, and continued support for three to twelve months.",
  },
  {
    question: "Is this a college admissions program?",
    answer:
      "A strong, original product can become meaningful evidence in an application, but admissions is not the curriculum. The primary outcome is agency: identifying a problem, building something real, shipping it, and learning from people who use it.",
  },
];

export default function BuildersLanding() {
  return (
    <main className={styles.page} lang="en">
      <header className={styles.navWrap}>
        <nav className={styles.nav} aria-label="Main navigation">
          <Link href="/builders" className={styles.brandLink} aria-label="Lantr Builders home">
            <Brand />
          </Link>
          <div className={styles.navLinks}>
            <a href="#method">Method</a>
            <a href="#year">The year</a>
            <a href="#programs">Programs</a>
            <a href="#questions">Questions</a>
          </div>
          <a href={GET_STARTED} className={styles.navCta}>
            Find your path <Arrow />
          </a>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.container}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>
                <span className={styles.liveDot} /> The personalized AI builder school
              </p>
              <h1>
                Don’t prepare students for the AI future.
                <em> Let them build it.</em>
              </h1>
              <p className={styles.heroLead}>
                Lantr turns a student’s interests into a personal curriculum, then surrounds
                them with the founders, tools, and pressure to ship something real.
              </p>
              <div className={styles.heroActions}>
                <a href="#programs" className={styles.primaryButton}>
                  Explore the programs <Arrow />
                </a>
                <Link href="/demo" className={styles.textLink}>
                  Try a student-built product <Arrow diagonal />
                </Link>
              </div>
              <div className={styles.heroTrust}>
                <span><Check /> No experience required</span>
                <span><Check /> Built around the student</span>
                <span><Check /> Every path ends in a launch</span>
              </div>
            </div>

            <div className={styles.osWrap} aria-label="Preview of the Lantr builder platform">
              <div className={styles.orbitOne} aria-hidden="true" />
              <div className={styles.orbitTwo} aria-hidden="true" />
              <div className={styles.osWindow}>
                <div className={styles.windowBar}>
                  <span className={styles.windowDots} aria-hidden="true">
                    <i /><i /><i />
                  </span>
                  <span>builder.lantr.ai</span>
                  <span className={styles.livePill}>LIVE PATH</span>
                </div>
                <div className={styles.osBody}>
                  <div className={styles.studentRow}>
                    <span className={styles.avatar}>AL</span>
                    <span>
                      <small>Alex’s north star</small>
                      <strong>Make financial research understandable</strong>
                    </span>
                    <b>72%</b>
                  </div>
                  <div className={styles.sprintHeading}>
                    <span>Personal roadmap</span>
                    <small>Adjusted after founder review</small>
                  </div>
                  <div className={styles.roadmap}>
                    <div className={styles.roadmapDone}>
                      <span>01</span><p><strong>Find the wedge</strong><small>Problem interviews · shipped</small></p><i>✓</i>
                    </div>
                    <div className={styles.roadmapDone}>
                      <span>02</span><p><strong>Build the brain</strong><small>Tool-calling agent · shipped</small></p><i>✓</i>
                    </div>
                    <div className={styles.roadmapNow}>
                      <span>03</span><p><strong>Give it hands</strong><small>Broker API + risk engine · now</small></p><i>→</i>
                    </div>
                    <div>
                      <span>04</span><p><strong>Earn the first user</strong><small>Feedback loop · next</small></p><i />
                    </div>
                  </div>
                  <div className={styles.copilotNudge}>
                    <span className={styles.copilotMark}>L</span>
                    <p>
                      <small>BUILDER COPILOT</small>
                      Your risk engine blocked its own first trade. Good. Capture that in the
                      demo—failure is the proof that the safeguard is real.
                    </p>
                  </div>
                </div>
              </div>
              <div className={styles.floatingNote}>
                <small>THIS WEEK</small>
                <strong>Ship → watch → revise</strong>
                <span>Not another tutorial.</span>
              </div>
            </div>
          </div>

          <div className={styles.signalBar}>
            <div><strong>01</strong><span>personal roadmap</span></div>
            <div><strong>Every week</strong><span>something working ships</span></div>
            <div><strong>12 months</strong><span>inside the ecosystem</span></div>
            <div><strong>0</strong><span>generic final assignments</span></div>
          </div>
        </div>
      </section>

      <section className={styles.agencySection}>
        <div className={styles.container}>
          <div className={styles.sectionIntro}>
            <p className={styles.eyebrow}>The real gap</p>
            <h2>AI access is everywhere. Agency isn’t.</h2>
            <p>
              The advantage will not go to the student who watched the most lessons. It will go
              to the one who can turn an unclear idea into a working product—and keep moving when
              the first version breaks.
            </p>
          </div>
          <div className={styles.tensionGrid}>
            <article>
              <span className={styles.tensionIcon}>⌁</span>
              <h3>Passive AI use</h3>
              <p>Answers arrive instantly, but judgment, taste, and ownership never develop.</p>
            </article>
            <article>
              <span className={styles.tensionIcon}>≡</span>
              <h3>Generic curriculum</h3>
              <p>Every student walks the same path whether or not it serves their ambition.</p>
            </article>
            <article className={styles.answerCard}>
              <span className={styles.tensionIcon}>↗</span>
              <h3>Lantr: build to learn</h3>
              <p>Concepts arrive at the moment they are needed to unblock a real launch.</p>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.methodSection} id="method">
        <div className={styles.container}>
          <div className={styles.methodGrid}>
            <div>
              <p className={`${styles.eyebrow} ${styles.eyebrowLight}`}>The Lantr method</p>
              <h2>Learn the way founders work.</h2>
              <p className={styles.methodLead}>
                We do not separate learning from doing. Each technical lesson has a job: move the
                product one step closer to a real person using it.
              </p>
              <ol className={styles.methodSteps}>
                <li><b>01</b><span><strong>Find signal</strong><small>Start from the student’s curiosity and a problem worth solving.</small></span></li>
                <li><b>02</b><span><strong>Build the smallest truth</strong><small>Make the core loop work before polishing the story.</small></span></li>
                <li><b>03</b><span><strong>Ship into reality</strong><small>Deploy, recruit users, watch them struggle, and listen.</small></span></li>
                <li><b>04</b><span><strong>Earn the next version</strong><small>Use evidence—not vibes—to decide what deserves to exist next.</small></span></li>
              </ol>
            </div>

            <article className={styles.proofCard}>
              <div className={styles.proofTop}>
                <span>Past student build / 01</span>
                <span className={styles.shippedBadge}>SHIPPED</span>
              </div>
              <div className={styles.proofScreen}>
                <div className={styles.miniNav}><span>AI Stock Analyst</span><i>Paper trading</i></div>
                <div className={styles.miniHero}>
                  <small>PORTFOLIO VALUE</small>
                  <strong>$103,204.55</strong>
                  <span>+$3,204.55 (+3.2%)</span>
                </div>
                <svg className={styles.chart} viewBox="0 0 500 130" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="builderChartFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#d7ff62" stopOpacity=".35" />
                      <stop offset="1" stopColor="#d7ff62" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0 112C44 108 61 100 90 104s44-34 78-24 54-12 79-15 45 18 78-4 52-4 78-32 56-12 97-24v125H0Z" fill="url(#builderChartFill)" />
                  <path d="M0 112C44 108 61 100 90 104s44-34 78-24 54-12 79-15 45 18 78-4 52-4 78-32 56-12 97-24" fill="none" stroke="#d7ff62" strokeWidth="3" />
                </svg>
                <div className={styles.miniStats}>
                  <span><small>AGENT</small><b>Researching</b></span>
                  <span><small>RISK ENGINE</small><b>7 checks</b></span>
                  <span><small>ORDERS</small><b>Approval only</b></span>
                </div>
              </div>
              <h3>This is not a pitch deck. It runs.</h3>
              <p>
                A live, multi-user AI portfolio manager with market tools, deterministic risk
                checks, memory, and scheduled research—built one working milestone at a time.
              </p>
              <Link href="/demo" className={styles.proofLink}>
                Open the live product <Arrow diagonal />
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.personalSection}>
        <div className={styles.container}>
          <div className={styles.personalGrid}>
            <div className={styles.personalCopy}>
              <p className={styles.eyebrow}>Personalized means personal</p>
              <h2>The curriculum moves when the student does.</h2>
              <p>
                Founders and advisors shape the path around background, ambition, project, and
                the blocker directly in front of the student. The roadmap is a living operating
                plan—not a playlist with their name on it.
              </p>
              <ul className={styles.plainList}>
                <li><Check /><span><strong>Starting point</strong> calibrated to current technical fluency</span></li>
                <li><Check /><span><strong>Project direction</strong> chosen from genuine interests</span></li>
                <li><Check /><span><strong>Lessons unlocked</strong> by the needs of the build</span></li>
                <li><Check /><span><strong>Reviews redirected</strong> toward the highest-leverage blocker</span></li>
              </ul>
            </div>

            <div className={styles.pathCard}>
              <div className={styles.pathHeader}>
                <span>
                  <small>CURRICULUM CHANGE / WEEK 06</small>
                  <strong>Roadmap updated by Jason</strong>
                </span>
                <span className={styles.pathAvatar}>JL</span>
              </div>
              <div className={styles.changeBlock}>
                <span className={styles.changeOld}>PLANNED</span>
                <p><s>Build another dashboard feature</s></p>
              </div>
              <div className={`${styles.changeBlock} ${styles.changeNew}`}>
                <span>NEW PRIORITY</span>
                <p><strong>Put the current product in front of five users.</strong></p>
                <small>The core loop works. More code will not answer the question that matters now.</small>
              </div>
              <div className={styles.pathFooter}>
                <span>Assigned next</span>
                <b>User interview sprint · 3 days</b>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.yearSection} id="year">
        <div className={styles.container}>
          <div className={styles.yearIntro}>
            <p className={styles.eyebrow}>Beyond the build</p>
            <h2>Eight intense weeks. A full year of forward motion.</h2>
            <p>
              The Fellowship begins with close, high-touch building. After launch, Lantr stays in
              the student’s corner with a structured cadence for traction, advice, and the next
              ambitious thing.
            </p>
          </div>
          <div className={styles.timeline}>
            <article>
              <span className={styles.timelineTime}>WEEK 0</span>
              <i />
              <strong>Founder diagnostic</strong>
              <p>Background, taste, ambitions, constraints, and the right first bet.</p>
            </article>
            <article className={styles.timelineActive}>
              <span className={styles.timelineTime}>WEEKS 1–8</span>
              <i />
              <strong>Private build intensive</strong>
              <p>Personal curriculum, weekly milestones, mentor review, and a live launch.</p>
            </article>
            <article>
              <span className={styles.timelineTime}>MONTHS 3–6</span>
              <i />
              <strong>Traction and impact</strong>
              <p>Find users, improve the product, and amplify what deserves attention.</p>
            </article>
            <article>
              <span className={styles.timelineTime}>MONTHS 7–12</span>
              <i />
              <strong>Keep building</strong>
              <p>Office hours, reviews, community, opportunities, and the next chapter.</p>
            </article>
          </div>

          <div className={styles.yearValueGrid}>
            <article><span>01</span><h3>Builder Copilot</h3><p>A project-aware companion grounded in Lantr’s curriculum and founder playbooks.</p></article>
            <article><span>02</span><h3>Monthly build rooms</h3><p>Bring the stuck point, leave with a decision and a concrete next shipment.</p></article>
            <article><span>03</span><h3>Quarterly reviews</h3><p>Step back with the team, inspect the evidence, and reset the roadmap.</p></article>
            <article><span>04</span><h3>Advisor access</h3><p>Focused conversations and introductions when the project and advisor genuinely fit.</p></article>
            <article><span>05</span><h3>Launch amplification</h3><p>Customer discovery, distribution playbooks, showcases, and introductions where possible.</p></article>
            <article><span>06</span><h3>Builder Club</h3><p>A durable home for challenges, collaborators, founder sessions, and ambitious peers.</p></article>
          </div>
        </div>
      </section>

      <section className={styles.copilotSection}>
        <div className={styles.container}>
          <div className={styles.copilotGrid}>
            <div className={styles.copilotWindow}>
              <div className={styles.copilotTop}>
                <span className={styles.copilotLogo}>L</span>
                <span><strong>Lantr Builder Copilot</strong><small>Project memory on · Week 6</small></span>
                <i>● ONLINE</i>
              </div>
              <div className={styles.chatBody}>
                <div className={styles.studentMessage}>I think I should add social login before I show it to anyone.</div>
                <div className={styles.aiMessage}>
                  <span className={styles.copilotLogo}>L</span>
                  <p>
                    That’s polish, not proof. Your Week 6 goal is to learn whether beginner
                    investors understand the approval flow.
                    <strong> Send the private demo to two people first.</strong> I made you a
                    five-question test script. Want it?
                  </p>
                </div>
              </div>
              <div className={styles.chatInput}><span>Ask about your build…</span><b>↑</b></div>
            </div>
            <div className={styles.copilotCopy}>
              <p className={`${styles.eyebrow} ${styles.eyebrowLight}`}>Lantr, between sessions</p>
              <h2>A builder companion that remembers the build.</h2>
              <p>
                Not a generic chatbot and not a fake founder clone. The Copilot brings Lantr’s
                methodology into the student’s day-to-day work: project context, relevant lessons,
                founder heuristics, and the next smallest action that creates evidence.
              </p>
              <div className={styles.copilotPoints}>
                <span>Knows the roadmap</span>
                <span>Links the right lesson</span>
                <span>Challenges over-planning</span>
                <span>Turns blockers into next actions</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.programsSection} id="programs">
        <div className={styles.container}>
          <div className={styles.programsIntro}>
            <p className={styles.eyebrow}>One system, three ways in</p>
            <h2>Start at the level of support that makes sense.</h2>
            <p>
              Every path produces a working product. The difference is how much direct access,
              personalization, and post-launch support surrounds the student.
            </p>
          </div>
          <div className={styles.programGrid}>
            {programs.map((program) => (
              <article
                key={program.name}
                className={`${styles.programCard} ${program.featured ? styles.programFeatured : ""}`}
              >
                {program.featured && <span className={styles.popularFlag}>MOST PERSONAL</span>}
                <p className={styles.programEyebrow}>{program.eyebrow}</p>
                <h3>{program.name}</h3>
                <div className={styles.price}>
                  <strong>{program.price}</strong><span>{program.suffix}</span>
                </div>
                <p className={styles.programDescription}>{program.description}</p>
                <ul>
                  {program.features.map((feature) => (
                    <li key={feature}><Check />{feature}</li>
                  ))}
                </ul>
                <a href={GET_STARTED} className={program.featured ? styles.programCtaFeatured : styles.programCta}>
                  {program.cta} <Arrow />
                </a>
              </article>
            ))}
          </div>
          <div className={styles.clubBar}>
            <div>
              <span className={styles.clubBadge}>L/</span>
              <span><small>THE CONTINUITY LAYER</small><strong>Builder Club</strong></span>
            </div>
            <p>
              Monthly challenges, build rooms, founder sessions, member demos, and the Builder
              Copilot. Included with every program; <strong>$59/month</strong> afterward.
            </p>
            <a href={GET_STARTED}>Explore the club <Arrow /></a>
          </div>
        </div>
      </section>

      <section className={styles.parentSection}>
        <div className={styles.container}>
          <div className={styles.parentGrid}>
            <div>
              <p className={styles.eyebrow}>For parents</p>
              <h2>See evidence of growth—not hours logged.</h2>
              <p>
                A parent should never have to wonder what eight weeks produced. Lantr turns the
                build into visible evidence: decisions made, systems understood, feedback earned,
                obstacles overcome, and a product anyone can open.
              </p>
              <blockquote>
                “The goal is not to make AI do more for the student. It is to make the student
                capable of doing more with AI.”
              </blockquote>
            </div>
            <div className={styles.reportCard}>
              <div className={styles.reportHeader}>
                <span><small>PROGRESS REPORT</small><strong>Builder evidence / Month 02</strong></span>
                <span className={styles.reportStatus}>ON TRACK</span>
              </div>
              <div className={styles.reportMetrics}>
                <span><strong>8</strong><small>working releases</small></span>
                <span><strong>11</strong><small>user conversations</small></span>
                <span><strong>4</strong><small>systems explained</small></span>
              </div>
              <div className={styles.reportSkill}>
                <span>Technical ownership</span><i><b style={{ width: "84%" }} /></i><strong>84</strong>
              </div>
              <div className={styles.reportSkill}>
                <span>Product judgment</span><i><b style={{ width: "71%" }} /></i><strong>71</strong>
              </div>
              <div className={styles.reportSkill}>
                <span>Follow-through</span><i><b style={{ width: "92%" }} /></i><strong>92</strong>
              </div>
              <div className={styles.reportNote}>
                <small>FOUNDER NOTE</small>
                Alex stopped building from assumptions and began testing the approval flow with
                novice investors. The next edge is clearer written communication.
              </div>
              <p className={styles.sampleLabel}>Sample progress view</p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.faqSection} id="questions">
        <div className={styles.container}>
          <div className={styles.faqGrid}>
            <div>
              <p className={styles.eyebrow}>Questions, answered</p>
              <h2>What parents usually ask us.</h2>
              <p>
                Still deciding where your student fits? We will recommend the smallest program
                that can get them to a meaningful first launch.
              </p>
              <a href={GET_STARTED} className={styles.textLink}>Talk through the fit <Arrow /></a>
            </div>
            <div className={styles.faqList}>
              {faqs.map((faq, index) => (
                <details key={faq.question} open={index === 0}>
                  <summary><span>{faq.question}</span><i>+</i></summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.finalSection}>
        <div className={styles.finalTexture} aria-hidden="true" />
        <div className={styles.container}>
          <div className={styles.finalCard}>
            <p className={`${styles.eyebrow} ${styles.eyebrowLight}`}>The next move</p>
            <h2>Give them somewhere worth directing all that intelligence.</h2>
            <p>
              Tell us what your student is obsessed with, what they have tried, and what they want
              to make real. We will map the right starting point.
            </p>
            <div className={styles.finalActions}>
              <a href={GET_STARTED} className={styles.primaryButton}>
                Find your Lantr path <Arrow />
              </a>
              <a href="mailto:team@lantr.ai" className={styles.finalTextLink}>team@lantr.ai</a>
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerTop}>
            <Brand />
            <p>Personalized founder education for the AI era.</p>
            <div>
              <a href="https://lantr.ai">Lantr</a>
              <a href="https://lantr.site/en">Student work</a>
              <a href="https://lantr.ai/about">Team</a>
              <a href="mailto:team@lantr.ai">Contact</a>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <span>© 2026 Lantr</span>
            <span>Build something that earns its place in the world.</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
