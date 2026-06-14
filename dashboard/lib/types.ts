// File: dashboard/lib/types.ts
export type Decision = "COSIGN" | "VETO";
export type Tier = "A" | "B" | "FLOOR";

export interface VerdictDTO {
  id: string;
  account: string;
  to: string;
  value: string;
  data: string;
  decision: Decision;
  tier: Tier;
  reasons: string[];
  deltas: {
    nativeSelfDelta: string;
    tokenSelfDeltas: string[];
    allowanceDeltas: string[];
    execOk: boolean;
  };
  llm: { decision: Decision; confidence: number; reason: string; unavailable?: boolean; provider?: string } | null;
  confidence: number;
  txHash: string | null;
  createdAt: number;
}
