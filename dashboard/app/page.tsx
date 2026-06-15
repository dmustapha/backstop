// File: dashboard/app/page.tsx — Landing (the front door).
import Link from "next/link";
import { Seal } from "../components/Seal";
import { LiveStat } from "../components/LiveStat";
import { CopyButton } from "../components/CopyButton";

const HOSTED_KEEPER = "https://backstop-keeper.onrender.com";

// Mode A — hosted guardian (zero infra). Real, copy-pasteable against the live keeper.
const INTEGRATE_SNIPPET = `import { wrap } from "@backstop/sdk";

// Wrap your agent's key once. Deploys a guarded account + ERC-8004 identity.
const agent = await wrap(AGENT_KEY, {
  keeperUrl: "${HOSTED_KEEPER}",   // hosted guardian
});

// Route every action through propose(). Backstop simulates it on live
// Mantle, co-signs the safe ones, and vetoes drainers with an on-chain event.
const { decision, txHash } = await agent.propose(to, value, data, {
  statedGoal: "swap 2 WMNT for USDC on Agni",
  expectedTargets: [AGNI_ROUTER],
});`;

const STEPS = [
  {
    n: "01",
    title: "Your agent proposes a transaction",
    body: "Every call the agent's wallet is about to make is intercepted by the co-signer before a single wei can leave — wrapped in three lines via backstop.wrap().",
  },
  {
    n: "02",
    title: "Backstop simulates it on live Mantle",
    body: "An eth_call with a code-override — zero deployment — traces the real balance and allowance deltas against live chain state, and weighs the agent's stated intent against the actual calldata.",
  },
  {
    n: "03",
    title: "It co-signs the safe ones, vetoes the drainers",
    body: "Deterministic rules catch known-drainer approvals in under a second. Gray-zone calls escalate to an LLM that writes the opinion. Every veto lands a real on-chain Blocked event.",
  },
];

export default function Landing() {
  return (
    <>
      {/* ── HERO ── */}
      {/* overflow-x:clip contains the decorative .hero-glow (520px absolute, right:-60px) so it
          cannot extend page width on narrow viewports — body's clip alone doesn't reach <html>. */}
      <section className="relative mx-auto min-h-[100dvh] max-w-[1140px] px-6 pb-24 pt-16 sm:pt-24" style={{ overflowX: "clip" }}>
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-16">
          <div className="min-w-0 flex-1">
            <p className="section-tag anim-rise">Filed · Mantle Sepolia · chainId 5003</p>
            <h1 className="serif anim-rise d1 mt-5" style={{ fontSize: "clamp(2.4rem,6.4vw,5.1rem)", letterSpacing: "-.02em" }}>
              The Turing Test,<br />inverted.
            </h1>

            <p className="serif anim-rise d2 measure mt-7" style={{ fontSize: "clamp(1.25rem,2.4vw,1.7rem)", lineHeight: 1.18, color: "var(--ink)" }}>
              Everyone built an agent that acts. We built the thing that keeps them from getting rekt.
            </p>

            <div className="anim-rise d3 prose-measure mt-8" style={{ color: "var(--ink-dim)" }}>
              <p style={{ fontSize: "1.02rem", lineHeight: 1.62 }}>
                The old question was whether a machine could pass for human. The one that matters for
                autonomous money is sharper:{" "}
                <span style={{ color: "var(--ink)", fontWeight: 500 }}>can you trust what this agent is about to do?</span>
              </p>
              <p className="mt-4" style={{ fontSize: ".95rem" }}>
                Backstop is the AI that judges another AI — co-signing every transaction your agent makes,
                simulating it on live Mantle first, and vetoing the ones that would drain its wallet.
                Every verdict in the console is a real on-chain event.
              </p>
            </div>

            <LiveStat className="anim-rise d4 mt-9" />

            <div className="anim-rise d5 mt-9 flex flex-wrap gap-3">
              <Link href="/console" className="btn-run">Open the live console</Link>
              <Link
                href="/sandbox"
                className="btn-ghost rounded-[10px] border px-5 py-[.7rem]"
                style={{ borderColor: "var(--rule)", color: "var(--ink-dim)", textDecoration: "none", fontWeight: 500 }}
              >
                Paste a transaction →
              </Link>
            </div>
          </div>

          {/* seal plate */}
          <div className="relative shrink-0 lg:w-[320px]">
            <div className="hero-glow" aria-hidden="true" />
            <div className="filing glass glass-edge relative flex flex-col items-center p-7 text-center">
              <Seal size={128} className="anim-seal" withArc />
              <p className="caps mt-6">Co-signer of record</p>
              <p className="mono mt-2 text-[.78rem]" style={{ color: "var(--ink-dim)" }}>
                ERC-8004 agentId <b style={{ color: "var(--ink)" }}>182</b>
              </p>
              <div className="rule mt-5 w-full pt-5">
                <p className="text-[.82rem]" style={{ color: "var(--ink-dim)", lineHeight: 1.5 }}>
                  A veto-only on-chain co-signer. It simulates first, then signs the safe and blocks the rest — entered into the record.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── THE CONCEPT ── */}
      <section className="rule-b rule" style={{ background: "color-mix(in oklab,var(--seal-faint) 60%,var(--surface))" }}>
        <div className="mx-auto max-w-[1140px] px-6 py-24">
          <p className="section-tag">One AI, judging another</p>
          <h2 className="serif io measure mt-3" style={{ fontSize: "clamp(1.7rem,3.4vw,2.6rem)", lineHeight: 1.12 }}>
            A guardian agent that reads a transaction the way a notary reads a filing — and refuses to sign the forgeries.
          </h2>
          <p className="prose-measure io mt-6" style={{ color: "var(--ink-dim)", maxWidth: "62ch", lineHeight: 1.6 }}>
            Autonomous agents already move real money. The dangerous failure isn&rsquo;t a crash — it&rsquo;s an
            agent confidently approving a drainer because injected instructions told it to. Backstop sits between
            the agent and the chain, gives the verdict the weight of a sealed ruling, and makes every decision
            auditable on-chain.
          </p>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="mx-auto max-w-[1140px] px-6 py-24">
        <p className="section-tag">How it works</p>
        <h2 className="serif mt-2" style={{ fontSize: "clamp(1.9rem,4vw,3rem)" }}>Three steps, every transaction</h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="filing io p-7">
              <p className="exhibit-no">STEP {s.n}</p>
              <h3 className="serif mt-3" style={{ fontSize: "1.45rem", lineHeight: 1.1 }}>{s.title}</h3>
              <p className="prose-measure mt-3 text-[.92rem]" style={{ color: "var(--ink-dim)", lineHeight: 1.6 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── INTEGRATE ── */}
      <section className="rule-b rule mx-auto max-w-[1140px] px-6 py-24">
        <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:gap-16">
          <div className="min-w-0 lg:w-[40%]">
            <p className="section-tag io">Adopt it</p>
            <h2 className="serif io mt-2" style={{ fontSize: "clamp(1.9rem,4vw,3rem)", lineHeight: 1.08 }}>
              Two lines, and your agent is guarded.
            </h2>
            <p className="prose-measure io mt-5" style={{ color: "var(--ink-dim)", maxWidth: "46ch", lineHeight: 1.62 }}>
              Point your agent&rsquo;s key at the hosted guardian and route its calls through{" "}
              <span className="mono" style={{ color: "var(--ink)" }}>propose()</span>. No contracts to write, no
              infra to run &mdash; the keeper is account-agnostic, so it guards a brand-new agent the moment you wrap it.
            </p>
            <div className="filing io mt-8 p-5" style={{ background: "var(--seal-faint)" }}>
              <p className="caps" style={{ color: "var(--seal-deep)" }}>Trust model</p>
              <p className="mt-2 text-[.88rem]" style={{ color: "var(--ink-dim)", lineHeight: 1.55 }}>
                The hosted guardian is a <b style={{ color: "var(--ink)" }}>testnet reference</b> &mdash; convenient
                for a demo, trusted for liveness. For production, self-host the keeper with your own{" "}
                <span className="mono">GUARDIAN_KEY</span> (<span className="mono">npm run keeper</span>) and pass
                your own <span className="mono">{`{ guardian, keeperUrl }`}</span>. Either way the guardian is
                veto-only &mdash; it can never move your funds.
              </p>
            </div>
          </div>

          <div className="min-w-0 flex-1 io">
            <CodeBlock code={INTEGRATE_SNIPPET} />
          </div>
        </div>
      </section>

      {/* ── PROOF TEASER ── */}
      <section className="rule-b rule" style={{ background: "color-mix(in oklab,var(--seal-faint) 60%,var(--surface))" }}>
        <div className="mx-auto max-w-[1140px] px-6 py-24">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="section-tag">On the record</p>
              <h2 className="serif mt-2" style={{ fontSize: "clamp(1.9rem,4vw,3rem)" }}>Verify every verdict yourself</h2>
              <p className="prose-measure mt-4" style={{ color: "var(--ink-dim)", maxWidth: "54ch", lineHeight: 1.6 }}>
                Both sides hold an ERC-8004 identity on-chain — the guardian and the agent it guards. Every veto
                lands a real <span className="mono">Blocked</span> event on Mantle Sepolia, reason and all. Click
                any verdict through to the explorer and read it for yourself.
              </p>
              <LiveStat className="mt-8" />
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/proof" className="btn-run">See the evidence</Link>
                <Link
                  href="/console"
                  className="btn-ghost rounded-[10px] border px-5 py-[.7rem]"
                  style={{ borderColor: "var(--rule)", color: "var(--ink-dim)", textDecoration: "none", fontWeight: 500 }}
                >
                  Watch the feed →
                </Link>
              </div>
            </div>

            <div className="flex shrink-0 gap-4">
              <IdCard label="Guardian" id="182" />
              <IdCard label="Guarded agent" id="183" href="/agent/183" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="filing relative overflow-hidden" style={{ background: "var(--surface-2)", padding: 0 }}>
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ borderBottom: "1px solid var(--rule)", background: "var(--surface)" }}
      >
        <span className="caps">agent.ts</span>
        <CopyButton value={code} />
      </div>
      <pre
        className="mono overflow-x-auto px-4 py-4 text-[.8rem]"
        style={{ lineHeight: 1.7, color: "var(--ink-dim)", margin: 0 }}
      >
        {code.split("\n").map((line, i) => (
          <div key={i} style={line.trim().startsWith("//") ? { color: "var(--ink-faint)" } : undefined}>
            {line || " "}
          </div>
        ))}
      </pre>
    </div>
  );
}

function IdCard({ label, id, href }: { label: string; id: string; href?: string }) {
  const body = (
    <div className={`filing flex w-[150px] flex-col items-center p-6 text-center${href ? " lift io" : ""}`}>
      <Seal size={56} />
      <p className="caps mt-4">{label}</p>
      <p className="mono mt-1 text-[.82rem]" style={{ color: "var(--ink)" }}>
        agentId <b style={{ color: "var(--seal)" }}>{id}</b>
      </p>
      {href && <p className="caps mt-2" style={{ color: "var(--seal)" }}>view history →</p>}
    </div>
  );
  return href ? (
    <Link href={href} style={{ textDecoration: "none" }}>{body}</Link>
  ) : body;
}
