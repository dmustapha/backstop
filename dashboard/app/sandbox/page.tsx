// File: dashboard/app/sandbox/page.tsx
import { PasteTxPanel } from "../../components/PasteTxPanel";

export default function Sandbox() {
  return (
    <section className="rule-b rule" style={{ background: "color-mix(in oklab,var(--seal-faint) 60%,var(--surface))" }}>
      <div className="mx-auto max-w-[1140px] px-6 py-24">
        <p className="section-tag">Simulation worksheet</p>
        <h1 className="serif mt-2" style={{ fontSize: "clamp(1.9rem,4vw,3rem)" }}>Paste any transaction</h1>
        <p className="measure mt-3" style={{ color: "var(--ink-dim)", maxWidth: "60ch", lineHeight: 1.6 }}>
          Not smoke. Paste any address and calldata — Backstop runs the real simulation against live Mantle
          state (an <span className="mono">eth_call</span> with a code-override, zero deployment) and tells you
          whether it would drain the account. Try to break it.
        </p>
        <div className="mt-12">
          <PasteTxPanel />
        </div>
      </div>
    </section>
  );
}
