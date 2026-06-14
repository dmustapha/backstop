// File: dashboard/components/DeltaTable.tsx
import { formatEther } from "viem";
import type { VerdictDTO } from "../lib/types";

const TOKENS = ["WMNT", "USDC", "USDT"]; // aligned with shared/addresses WATCHED_TOKENS order

export function DeltaTable({ deltas }: { deltas: VerdictDTO["deltas"] }) {
  const native = BigInt(deltas.nativeSelfDelta);
  return (
    <table className="ledger mt-5">
      <tbody>
        <Row label="MNT (native)" value={native} />
        {deltas.tokenSelfDeltas.map((d, i) => (
          <Row key={i} label={TOKENS[i] ?? `token${i}`} value={BigInt(d)} />
        ))}
        <tr>
          <td style={{ color: "var(--ink-dim)" }}>Execution</td>
          <td className={`num ${deltas.execOk ? "in" : "out"}`}>
            {deltas.execOk ? "ok · settled" : "reverted by guardian"}
          </td>
        </tr>
      </tbody>
    </table>
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
