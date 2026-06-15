// File: dashboard/app/agent/[id]/page.tsx
import { fetchVerdicts, addrLink } from "../../../lib/api";
import { VerdictCard } from "../../../components/VerdictCard";

const ADDR = /^0x[0-9a-fA-F]{40}$/;
// The verdict feed is keyed by the guarded BackstopAccount ADDRESS, not the ERC-8004 agentId, and the
// agentId↔account link is off-chain by design (see BackstopAccountFactory: it lives in AccountCreated
// + the keeper). So bare agentIds are resolved here for the known on-chain demo agents; an address is
// used directly. 183 = the seeded demo agent; 216 = the live fresh-onboard proof agent (see /proof).
const AGENT_TO_ACCOUNT: Record<string, string> = {
  "183": process.env.NEXT_PUBLIC_DEMO_ACCOUNT ?? "",
  "216": "0xa36Aa5C4402C229ad6Ef50D1f2A58DB5ACC4DE96",
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
          <div className="filing grid place-items-center gap-3 p-16 text-center" style={{ borderStyle: "dashed" }}>
            <p className="caps">No verdicts in the live feed for this account.</p>
            {ADDR.test(account) && (
              <a className="exlink mono text-[.8rem]" href={addrLink(account)} target="_blank" rel="noreferrer">
                view this account on MantleScan ↗
              </a>
            )}
          </div>
        )}
        {verdicts.map((v) => (
          <VerdictCard key={v.id} v={v} />
        ))}
      </div>
    </section>
  );
}
