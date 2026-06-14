// File: dashboard/app/console/page.tsx — the live verdict feed (the docket).
"use client";
import { useVerdictStream } from "../../lib/useVerdictStream";
import { VerdictCard } from "../../components/VerdictCard";

export default function Console() {
  const verdicts = useVerdictStream();
  const vetoed = verdicts.filter((v) => v.decision === "VETO").length;
  const cosigned = verdicts.length - vetoed;

  return (
    <section className="mx-auto max-w-[1140px] px-6 py-20">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-tag inline-flex items-center gap-2">
            <span className="dot pip" style={{ background: "var(--seal)" }} />
            Docket · live verdict feed
          </p>
          <h1 className="serif mt-2" style={{ fontSize: "clamp(1.9rem,4vw,3rem)" }}>The record</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
            <span className="pill pill-ok">
              <span className="dot pip" style={{ background: "var(--ok)" }} />
              <span className="num mono">{cosigned}</span> co-signed
            </span>
            <span className="pill pill-veto">
              <span className="dot" style={{ background: "var(--veto)" }} />
              <span className="num mono">{vetoed}</span> vetoed
            </span>
          </div>
        </div>
        <p className="measure text-[.82rem]" style={{ color: "var(--ink-dim)", maxWidth: "42ch", lineHeight: 1.6 }}>
          Each entry is a verdict the guardian entered on-chain. Newest is filed at the top — the verdict is read first; the evidence supports beneath.
        </p>
      </div>

      <div className="space-y-6">
        {verdicts.length === 0 && (
          <div className="filing grid place-items-center p-16 text-center" style={{ borderStyle: "dashed" }}>
            <p className="caps inline-flex items-center gap-2">
              <span className="dot pip" style={{ background: "var(--seal)" }} />
              Connecting to the keeper…
            </p>
            <p className="mt-2 text-[.82rem]" style={{ color: "var(--ink-dim)" }}>
              The guardian is waking — the record loads in a moment.
            </p>
          </div>
        )}
        {verdicts.map((v) => (
          <VerdictCard key={v.id} v={v} />
        ))}
      </div>
    </section>
  );
}
