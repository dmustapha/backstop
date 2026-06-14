// File: dashboard/components/LiveStat.tsx
// Live co-signed / vetoed counts off the real keeper stream. Used on the landing
// hero + proof teaser. Falls back to a calm "connecting" state before first data.
"use client";
import { useVerdictStream } from "../lib/useVerdictStream";

export function LiveStat({ className = "" }: { className?: string }) {
  const verdicts = useVerdictStream();
  const vetoed = verdicts.filter((v) => v.decision === "VETO").length;
  const cosigned = verdicts.length - vetoed;
  const live = verdicts.length > 0;

  return (
    <div className={`flex flex-wrap items-center gap-x-6 gap-y-3 ${className}`}>
      <span className="pill pill-ok">
        <span className="dot pip" style={{ background: "var(--ok)" }} />
        <span className="num mono">{cosigned}</span> co-signed
      </span>
      <span className="pill pill-veto">
        <span className="dot" style={{ background: "var(--veto)" }} />
        <span className="num mono">{vetoed}</span> vetoed
      </span>
      <span className="caps inline-flex items-center gap-2">
        <span className="dot pip" style={{ background: "var(--seal)" }} />
        {live ? "Keeper live · streaming verdicts" : "Connecting to keeper…"}
      </span>
    </div>
  );
}
