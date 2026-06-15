// File: dashboard/components/DeltaTable.tsx
import { formatEther } from "viem";
import type { VerdictDTO } from "../lib/types";

const TOKENS = ["WMNT", "USDC", "USDT"]; // aligned with shared/addresses WATCHED_TOKENS order

// The deltas are the SIMULATED effect of the proposed call (an eth_call with a code-override), not the
// real settled outcome — that is the whole point: we see what WOULD happen, then veto or co-sign.
// `execOk` = the simulation ran without reverting. On a VETO that means "this would have executed
// cleanly, which is exactly why we blocked it" — never "the tx settled". Label it so it can't be misread.
export function DeltaTable({ deltas, decision }: { deltas: VerdictDTO["deltas"]; decision: VerdictDTO["decision"] }) {
  const native = BigInt(deltas.nativeSelfDelta);
  const veto = decision === "VETO";
  const execText = !deltas.execOk
    ? "would revert"
    : veto
      ? "would execute · blocked"
      : "executes · co-signed";
  return (
    <>
      <p className="caps mt-5 mb-1 text-[.66rem]" style={{ color: "var(--ink-faint)" }}>Simulated effect</p>
      <table className="ledger">
        <tbody>
          <Row label="MNT (native)" value={native} />
          {deltas.tokenSelfDeltas.map((d, i) => (
            <Row key={i} label={TOKENS[i] ?? `token${i}`} value={BigInt(d)} />
          ))}
          <tr>
            <td style={{ color: "var(--ink-dim)" }}>Simulation</td>
            <td className={`num ${deltas.execOk && !veto ? "in" : "out"}`}>{execText}</td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

function Row({ label, value }: { label: string; value: bigint }) {
  if (value === 0n) return null;
  const neg = value < 0n;
  const show = formatEther(neg ? -value : value);
  return (
    <tr>
      <td style={{ color: "var(--ink-dim)" }}>{label}</td>
      <td className={`num ${neg ? "out" : "in"}`}>
        {neg ? "OUT" : "IN"} · {show}
      </td>
    </tr>
  );
}
