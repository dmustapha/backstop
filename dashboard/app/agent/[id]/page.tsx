// File: dashboard/app/agent/[id]/page.tsx
import { fetchVerdicts } from "../../../lib/api";
import { VerdictCard } from "../../../components/VerdictCard";

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const verdicts = await fetchVerdicts(50, id);
  return (
    <section className="mx-auto max-w-[1140px] px-6 py-20">
      <p className="section-tag">Per-agent record</p>
      <h1 className="serif mt-2" style={{ fontSize: "clamp(1.9rem,4vw,3rem)" }}>Agent history</h1>
      <p className="mono mt-3 text-[.8rem]" style={{ color: "var(--ink-dim)" }}>{id}</p>

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
