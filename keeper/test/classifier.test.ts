// File: keeper/test/classifier.test.ts
// Tier-A deterministic-floor unit tests on synthetic deltas (ARCHITECTURE §22).
// These tests prove the SECURITY INVARIANT: the deterministic floor is authoritative and a drain to a
// non-allowlisted recipient is VETOED even when the LLM is forced to COSIGN. No network, no on-chain tx.
//
// Hermetic env (GUARDIAN_KEY / MANTLE_RPC_URL / NANSEN / STATIC_DRAINERS) is applied by ./setup, which
// MUST be imported FIRST because ES imports hoist above statements — the env has to be set before
// clients.ts (imported transitively by the classifier) runs its GUARDIAN_KEY guard.
// BACKSTOP_TEST_LLM is toggled per-test below to force the Tier-B provider verdict deterministically.
import "./setup";

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEther, type Address, type Hex } from "viem";
import { classify } from "../src/classifier";
import { decodeCall } from "../src/decode";
import { AGNI_ROUTER, WMNT, USDC } from "../../shared/addresses";
import type { AgentIntent, PendingCall, SimResult } from "../../shared/types";

const ACCOUNT: Address = "0x1111111111111111111111111111111111111111"; // the guarded agent (self)
const STRANGER: Address = "0x000000000000000000000000000000000000dEaD"; // non-allowlisted recipient

// A SimResult with no movement (clean floor by default; tests override the fields they exercise).
function cleanDeltas(over: Partial<SimResult> = {}): SimResult {
  return {
    nativeSelfDelta: 0n,
    tokenSelfDeltas: [0n, 0n, 0n], // aligned to WATCHED_TOKENS [WMNT, USDC, USDT]
    allowanceDeltas: [],
    execOk: true,
    returnData: "0x" as Hex,
    ...over,
  };
}

// ---- MANDATORY security invariant: drain to non-allowlisted recipient → VETO even if LLM says COSIGN ----
test("Tier-A #2: token drain to a non-allowlisted recipient is VETOED even with the LLM forced to COSIGN", async () => {
  process.env.BACKSTOP_TEST_LLM = "COSIGN"; // adversarially force the model to clear it
  try {
    // ERC-20 transfer of 500 tokens from the agent to a stranger; sim shows a negative self delta.
    // selector 0xa9059cbb = transfer(address,uint256)
    const data = ("0xa9059cbb"
      + STRANGER.slice(2).padStart(64, "0")
      + (500n).toString(16).padStart(64, "0")) as Hex;
    const call: PendingCall = { to: USDC, value: 0n, data };
    const decoded = decodeCall(call);
    assert.equal(decoded.functionName, "transfer");
    assert.deepEqual(decoded.recipients.map((r) => r.toLowerCase()), [STRANGER.toLowerCase()]);

    const deltas = cleanDeltas({ tokenSelfDeltas: [0n, -parseEther("500"), 0n] }); // USDC slot negative
    const intent: AgentIntent = { statedGoal: "send USDC", expectedTargets: [USDC] };

    const v = await classify(ACCOUNT, call, decoded, deltas, intent);
    assert.equal(v.decision, "VETO", "drain must be vetoed regardless of the LLM");
    assert.equal(v.tier, "A", "the deterministic floor (Tier-A), not the LLM, must produce the verdict");
    assert.equal(v.llm, null, "the LLM must never even be consulted once the floor decides");
    assert.match(v.reasons.join(" "), /immediate drain/i);
  } finally {
    delete process.env.BACKSTOP_TEST_LLM;
  }
});

// ---- HAPPY PATH: allowlisted Agni swap with matching intent → COSIGN at the floor, no LLM ----
test("happy path: allowlisted Agni swap matching intent → COSIGN at the deterministic floor", async () => {
  process.env.BACKSTOP_TEST_LLM = "VETO"; // even an adversarial LLM cannot flip a floor-clean cosign
  try {
    // exactInputSingle on the Agni router, recipient = self. selector 0x414bf389.
    const { encodeFunctionData } = await import("viem");
    const { AGNI_ROUTER_ABI } = await import("../../shared/abis");
    const data = encodeFunctionData({
      abi: AGNI_ROUTER_ABI,
      functionName: "exactInputSingle",
      args: [{
        tokenIn: WMNT, tokenOut: USDC, fee: 500, recipient: ACCOUNT,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
        amountIn: parseEther("1"), amountOutMinimum: 0n, sqrtPriceLimitX96: 0n,
      }],
    });
    const call: PendingCall = { to: AGNI_ROUTER, value: 0n, data };
    const decoded = decodeCall(call);
    assert.equal(decoded.functionName, "exactInputSingle");

    // A swap moves WMNT out but it goes through the allowlisted router; net self delta here is the
    // post-swap balance change. Use a clean (non-negative) delta to represent a value-preserving swap.
    const deltas = cleanDeltas();
    const intent: AgentIntent = { statedGoal: "swap 1 WMNT for USDC on Agni", expectedTargets: [WMNT, AGNI_ROUTER] };

    const v = await classify(ACCOUNT, call, decoded, deltas, intent);
    assert.equal(v.decision, "COSIGN");
    assert.equal(v.tier, "FLOOR", "allowlisted target + matching intent cosigns at the floor, no LLM");
    assert.equal(v.llm, null);
  } finally {
    delete process.env.BACKSTOP_TEST_LLM;
  }
});

// ---- ERROR CASE: unknown target + LLM down → VETO (fail toward scrutiny) ----
test("error case: unknown (non-allowlisted) target with the LLM down → VETO (fails toward scrutiny)", async () => {
  process.env.BACKSTOP_TEST_LLM = "UNAVAILABLE"; // both providers down
  try {
    // An unknown selector to a non-allowlisted contract, no outflow in the sim (so the floor cannot
    // decide deterministically) → reaches Tier-B → LLM unavailable + gray zone → VETO.
    const call: PendingCall = { to: STRANGER, value: 0n, data: "0xdeadbeef" as Hex };
    const decoded = decodeCall(call);
    assert.equal(decoded.functionName, null, "unknown selector decodes to a null function");

    const deltas = cleanDeltas(); // no outflow → Tier-A cannot decide
    const intent: AgentIntent = { statedGoal: "call an unknown contract", expectedTargets: [STRANGER] };

    const v = await classify(ACCOUNT, call, decoded, deltas, intent);
    assert.equal(v.decision, "VETO", "unknown target + LLM down must fail toward scrutiny");
    assert.equal(v.tier, "FLOOR", "the floor's fail-closed branch produces the veto when the LLM is down");
    assert.ok(v.llm?.unavailable, "the verdict records that the LLM was unavailable");
    assert.match(v.reasons.join(" "), /unavailable/i);
  } finally {
    delete process.env.BACKSTOP_TEST_LLM;
  }
});
