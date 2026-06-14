// File: dashboard/app/agent/[id]/page.tsx
import { fetchVerdicts } from "../../../lib/api";
import { VerdictCard } from "../../../components/VerdictCard";

const ADDR = /^0x[0-9a-fA-F]{40}$/;
// The verdict feed is keyed by the guarded BackstopAccount ADDRESS, not the ERC-8004 agentId.
// Resolve a bare agentId to its account so /agent/183 (the id surfaced across the UI) is not empty;
// an address is used directly. The demo's guarded agentId 183 → its account.
const AGENT_TO_ACCOUNT: Record<string, string> = {
  "183": process.env.NEXT_PUBLIC_DEMO_ACCOUNT ?? "",
};

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = ADDR.test(id) ? id : (AGENT_TO_ACCOUNT[id] || id);
  const verdicts = await fetchVerdicts(50, account);
  const resolved = !ADDR.test(id) && ADDR.test(account);
  return (
    <section className="mx-auto max-w-[1140px] px-6 py-20">
      <p className="section-tag">Per-agent record</p>
      <h1 className="serif mt-2" style={{ fontSize: "clamp(1.9rem,4vw,3rem)" }}>Agent history</h1>
      <p className="mono mt-3 text-[.8rem]" style={{ color: "var(--ink-dim)" }}>
        {resolved ? `agentId ${id} · ${account}` : id}
      </p>

      <div className="mt-10 space-y-6">
        {verdicts.length === 0 && (
          <div className="filing grid place-items-center p-16 text-center" style={{ borderStyle: "dashed" }}>
            <p className="caps">No verdicts for this account yet.</p>
          </div>
        )}
        {verdicts.map((v) => (
          <VerdictCard key={v.id} v={v} />
        ))}
      </div>
    </section>
  );
}
