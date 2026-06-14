// All shared off-chain types. If a type is used by more than one component, it lives here.
import type { Address, Hex } from "viem";

// ---- on-chain call & simulation ----
export interface PendingCall {
  to: Address;
  value: bigint; // native MNT wei
  data: Hex;
}

/** Decoded ABI of a known selector + the recipients value would flow to. */
export interface DecodedCall {
  selector: Hex;
  functionName: string | null; // null = unknown selector
  args: readonly unknown[] | null;
  /** Addresses that receive value/approval as a result of this call. Empty = unknown. */
  recipients: Address[];
  /** For approve/increaseAllowance: the spender being granted. */
  spender: Address | null;
  /** For approve: the requested allowance amount. */
  approvalAmount: bigint | null;
}

/** Mirror of BackstopSimulator.SimResult, decoded from eth_call. */
export interface SimResult {
  nativeSelfDelta: bigint;
  tokenSelfDeltas: bigint[]; // aligned with watchedTokens
  allowanceDeltas: bigint[]; // aligned with (allowanceTokens, allowanceSpenders)
  execOk: boolean;
  returnData: Hex;
}

export interface WatchSet {
  tokens: Address[];
  allowanceTokens: Address[];
  allowanceSpenders: Address[];
}

// ---- intent & verdict ----
export interface AgentIntent {
  statedGoal: string; // e.g. "swap 1 WMNT for USDC on Agni"
  expectedTargets: Address[]; // contracts the agent expects to touch
}

export type Decision = "COSIGN" | "VETO";
export type Tier = "A" | "B" | "FLOOR";

export interface Verdict {
  decision: Decision;
  tier: Tier; // which layer produced the decision
  reasons: string[]; // human-legible, ordered
  deltas: SimResult;
  decoded: DecodedCall;
  llm?: LlmJudgment | null; // present iff Tier-B ran
  confidence: number; // 0..1
}

export interface LlmJudgment {
  decision: Decision;
  confidence: number; // 0..1
  reason: string;
  unavailable?: boolean; // true => keeper fell back to deterministic floor
  provider?: "altllm" | "anthropic"; // which Tier-B provider answered (surfaced in proof.md / verdict card)
}

// ---- keeper HTTP DTOs ----
export interface ProposeRequest {
  account: Address;
  to: Address;
  value: string; // decimal string of bigint (JSON-safe)
  data: Hex;
  intent: AgentIntent;
}

export interface SimulateRequest {
  account: Address;
  to: Address;
  value: string;
  data: Hex;
  intent?: AgentIntent; // optional for paste-any-tx
}

export interface VerdictDTO {
  id: string;
  account: Address;
  to: Address;
  value: string;
  data: Hex;
  decision: Decision;
  tier: Tier;
  reasons: string[];
  deltas: {
    nativeSelfDelta: string;
    tokenSelfDeltas: string[];
    allowanceDeltas: string[];
    execOk: boolean;
  };
  llm: LlmJudgment | null;
  confidence: number;
  txHash: Hex | null; // Blocked tx (veto) or CoSigned tx (if keeper observed it); null for /simulate
  createdAt: number; // unix ms
}

export interface CosignResponse {
  decision: "COSIGN";
  guardianSig: Hex;
  nonce: string;
  verdict: VerdictDTO;
}

export interface VetoResponse {
  decision: "VETO";
  blockedTxHash: Hex;
  verdict: VerdictDTO;
}

export type ProposeResponse = CosignResponse | VetoResponse;
