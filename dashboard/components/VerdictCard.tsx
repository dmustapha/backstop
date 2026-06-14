// File: dashboard/components/VerdictCard.tsx
import type { VerdictDTO } from "../lib/types";
import { txLink, addrLink } from "../lib/api";
import { DeltaTable } from "./DeltaTable";

// [CRITIQUE E-1] Honest label-source badge. The verdict's label source is only carried in the
// reasons text as a `nansen:<label>` or `static:<label>` token (e.g. "static:known-drainer").
// We derive the badge from that — and NEVER claim Nansen unless the source is literally nansen.
function labelBadge(reasons: string[]): { text: string; nansen: boolean } | null {
  const blob = reasons.join(" ");
  const nansen = blob.match(/nansen:([^\s,)\]]+)/i);
  if (nansen) return { text: `Nansen: ${nansen[1]}`, nansen: true };
  if (/static:known-drainer|static:/i.test(blob)) return { text: "known-drainer list", nansen: false };
  return null;
}

const TIER_LABEL: Record<VerdictDTO["tier"], string> = { A: "TIER A", B: "TIER B", FLOOR: "FLOOR" };

function short(a: string) {
  return `${a.slice(0, 10)}…${a.slice(-6)}`;
}

export function VerdictCard({ v, starred = false }: { v: VerdictDTO; starred?: boolean }) {
  const veto = v.decision === "VETO";
  const badge = labelBadge(v.reasons);
  // [CRITIQUE E-6] surface the LLM provider on Tier-B verdicts (makes the AltLLM integration visible).
  const provider = v.tier === "B" && v.llm?.provider ? v.llm.provider : null;
  const conf = Math.round((v.llm?.confidence ?? v.confidence ?? 1) * 100);
  const time = new Date(v.createdAt).toLocaleTimeString();
  // Tier-A/FLOOR carry their reasoning in reasons[]; Tier-B carries it in llm.reason (avoid duplicating the raw "Tier-B LLM:" line).
  const proseReasons = v.llm ? [] : v.reasons;

  return (
    <article className={`filing lift io p-6 sm:p-8 ${starred ? "filing-starred" : ""}`}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="shrink-0 sm:w-[150px]">
          <p className="exhibit-no">{TIER_LABEL[v.tier]}{starred ? " ★" : ""}</p>
          <p className="serif mt-1 text-[2.1rem]" style={{ lineHeight: 1 }}>
            <span className={`stamp ${veto ? "stamp-veto" : "stamp-ok"}`}>{veto ? "Veto" : "Co-sign"}</span>
          </p>
          <p className="mono mt-3 text-[.7rem]" style={{ color: "var(--ink-faint)" }}>
            {v.tier === "B" ? "8–15s" : "<1s"} · {time} · conf {conf}%
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {badge && <span className="pill pill-seal">{badge.text}</span>}
            {provider && <span className="pill pill-seal">judged by: {provider}</span>}
            <span className="pill">
              target{" "}
              <a className="mono exlink" href={addrLink(v.to)} target="_blank" rel="noreferrer" style={{ color: "var(--ink)", borderBottom: "none" }}>
                {short(v.to)}
              </a>
            </span>
          </div>

          {v.llm ? (
            <>
              <p className="caps mb-1 text-[.7rem]">AI opinion ({conf}%)</p>
              <p className="prose-measure serif" style={{ fontSize: "1.12rem", lineHeight: 1.34, color: "var(--ink)" }}>
                &ldquo;{v.llm.reason}&rdquo;
              </p>
            </>
          ) : (
            proseReasons.map((r, i) => (
              <p key={i} className="prose-measure" style={{ color: "var(--ink)", marginTop: i ? ".5rem" : 0 }}>
                {r}
              </p>
            ))
          )}

          <DeltaTable deltas={v.deltas} />

          {v.txHash && (
            <p className="mt-4 text-[.82rem]">
              <a className="exlink mono" href={txLink(v.txHash)} target="_blank" rel="noreferrer">
                {veto ? "Blocked" : "CoSigned"} on-chain ↗
              </a>
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
