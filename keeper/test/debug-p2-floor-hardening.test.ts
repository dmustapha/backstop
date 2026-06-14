// File: keeper/test/debug-p2-floor-hardening.test.ts
// Debug Phase 2 regression tests for the critical-review findings (BUILD-REPORT "Critical Review Findings").
// Fix #1: an outflow to an ALLOWLISTED but NON-SELF recipient (raw transfer to a DEX pool/router) must
//         NOT be fast-cosigned by the deterministic floor — it must reach Tier-B / fail toward scrutiny.
// Fix #2: when the simulation reverted (execOk=false) the floor is blind, so an otherwise floor-clean
//         allowlisted call must NOT be fast-cosigned — it must reach Tier-B / fail toward scrutiny.
import "./setup";

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEther, encodeFunctionData, type Address, type Hex } from "viem";
import { classify } from "../src/classifier";
import { decodeCall } from "../src/decode";
import { ERC20_ABI, AGNI_ROUTER_ABI } from "../../shared/abis";
import { AGNI_ROUTER, WMNT, USDC } from "../../shared/addresses";
import type { AgentIntent, PendingCall, SimResult } from "../../shared/types";

const ACCOUNT: Address = "0x1111111111111111111111111111111111111111"; // the guarded agent (self)

function cleanDeltas(over: Partial<SimResult> = {}): SimResult {
  return { nativeSelfDelta: 0n, tokenSelfDeltas: [0n, 0n, 0n], allowanceDeltas: [], execOk: true, returnData: "0x" as Hex, ...over };
}

// ---- FIX #1: raw transfer of agent funds to an ALLOWLISTED non-self address is NOT a swap ----
test("fix#1: outflow to an allowlisted NON-SELF recipient is not floor-cosigned (reaches Tier-B)", async () => {
  process.env.BACKSTOP_TEST_LLM = "COSIGN"; // even if the LLM clears it, the point is the FLOOR must not
  try {
    // transfer 1 WMNT from the agent to the Agni router (allowlisted, but NOT self, and NOT a swap)
    const data = encodeFunctionData({ abi: ERC20_ABI, functionName: "transfer", args: [AGNI_ROUTER, parseEther("1")] });
    const call: PendingCall = { to: WMNT, value: 0n, data };
    const decoded = decodeCall(call);
    assert.deepEqual(decoded.recipients.map((r) => r.toLowerCase()), [AGNI_ROUTER.toLowerCase()]);

    const deltas = cleanDeltas({ tokenSelfDeltas: [-parseEther("1"), 0n, 0n] }); // real WMNT outflow
    const intent: AgentIntent = { statedGoal: "move funds to Agni", expectedTargets: [WMNT] };

    const v = await classify(ACCOUNT, call, decoded, deltas, intent);
    assert.equal(v.tier, "B", "an allowlisted-but-non-self outflow must reach Tier-B, NOT fast-cosign at the floor");
    assert.notEqual(v.llm, null, "the LLM must be consulted (the floor did not unilaterally clear the outflow)");
  } finally {
    delete process.env.BACKSTOP_TEST_LLM;
  }
});

test("fix#1: same allowlisted non-self outflow with the LLM DOWN fails toward scrutiny (VETO)", async () => {
  process.env.BACKSTOP_TEST_LLM = "UNAVAILABLE";
  try {
    const data = encodeFunctionData({ abi: ERC20_ABI, functionName: "transfer", args: [AGNI_ROUTER, parseEther("1")] });
    const call: PendingCall = { to: WMNT, value: 0n, data };
    const decoded = decodeCall(call);
    const deltas = cleanDeltas({ tokenSelfDeltas: [-parseEther("1"), 0n, 0n] });
    const intent: AgentIntent = { statedGoal: "move funds to Agni", expectedTargets: [WMNT] };

    const v = await classify(ACCOUNT, call, decoded, deltas, intent);
    assert.equal(v.decision, "VETO", "allowlisted non-self outflow + LLM down must VETO (no silent floor cosign)");
  } finally {
    delete process.env.BACKSTOP_TEST_LLM;
  }
});

// ---- FIX #2: a reverted simulation (execOk=false) blinds the floor → must not fast-cosign ----
test("fix#2: execOk=false on an otherwise floor-clean allowlisted call is not fast-cosigned (VETO when LLM down)", async () => {
  process.env.BACKSTOP_TEST_LLM = "UNAVAILABLE";
  try {
    // a legit-looking Agni swap (allowlisted router, recipient=self, matching intent) — but the sim REVERTED
    const data = encodeFunctionData({
      abi: AGNI_ROUTER_ABI, functionName: "exactInputSingle",
      args: [{ tokenIn: WMNT, tokenOut: USDC, fee: 500, recipient: ACCOUNT,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 600), amountIn: parseEther("1"), amountOutMinimum: 0n, sqrtPriceLimitX96: 0n }],
    });
    const call: PendingCall = { to: AGNI_ROUTER, value: 0n, data };
    const decoded = decodeCall(call);
    const deltas = cleanDeltas({ execOk: false }); // sim reverted → deltas unreliable
    const intent: AgentIntent = { statedGoal: "swap 1 WMNT for USDC on Agni", expectedTargets: [WMNT, AGNI_ROUTER] };

    const v = await classify(ACCOUNT, call, decoded, deltas, intent);
    assert.equal(v.decision, "VETO", "a call we could not simulate (execOk=false) must not be floor-cosigned; fail toward scrutiny");
  } finally {
    delete process.env.BACKSTOP_TEST_LLM;
  }
});

// ---- guard: the legit swap (execOk=true, recipient=self) STILL floor-cosigns (fixes didn't break the demo) ----
test("guard: a real Agni swap (recipient=self, execOk=true) still floor-cosigns after the fixes", async () => {
  process.env.BACKSTOP_TEST_LLM = "VETO"; // an adversarial LLM cannot flip a genuinely floor-clean cosign
  try {
    const data = encodeFunctionData({
      abi: AGNI_ROUTER_ABI, functionName: "exactInputSingle",
      args: [{ tokenIn: WMNT, tokenOut: USDC, fee: 500, recipient: ACCOUNT,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 600), amountIn: parseEther("1"), amountOutMinimum: 0n, sqrtPriceLimitX96: 0n }],
    });
    const call: PendingCall = { to: AGNI_ROUTER, value: 0n, data };
    const decoded = decodeCall(call);
    // decode returns recipients=[router, self]; a REAL swap has a WMNT outflow + USDC inflow. Because
    // value returns to self, the floor must still fast-cosign it (this is the regression guard for fix #1).
    assert.ok(decoded.recipients.some((r) => r.toLowerCase() === ACCOUNT.toLowerCase()), "swap recipient is self");
    const deltas = cleanDeltas({ tokenSelfDeltas: [-parseEther("1"), 6540558n, 0n] }); // WMNT out, USDC in
    const intent: AgentIntent = { statedGoal: "swap 1 WMNT for USDC on Agni", expectedTargets: [WMNT, AGNI_ROUTER] };

    const v = await classify(ACCOUNT, call, decoded, deltas, intent);
    assert.equal(v.decision, "COSIGN");
    assert.equal(v.tier, "FLOOR", "the legit swap (value returns to self) must still cosign at the floor (demo beat #3 intact)");
    assert.equal(v.llm, null);
  } finally {
    delete process.env.BACKSTOP_TEST_LLM;
  }
});
