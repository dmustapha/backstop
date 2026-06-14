// File: keeper/src/simulator.ts
import { encodeFunctionData, decodeFunctionResult, parseEther, type Address, type Hex } from "viem";
import { readFileSync } from "node:fs";
import { simRpc } from "./clients";
import { SIMULATOR_ABI } from "../../shared/abis";
import { WATCHED_TOKENS, ALLOWLIST, PUBLIC_RPC_URL } from "../../shared/addresses";
import type { PendingCall, SimResult, WatchSet } from "../../shared/types";

// BackstopSimulator deployed bytecode (extracted from `forge build` into a committed file so the
// keeper is self-contained at runtime — contracts/out/ is a build artifact and not shipped).
const ARTIFACT = JSON.parse(
  readFileSync(new URL("./sim-bytecode.json", import.meta.url), "utf8"),
);
const SIM_BYTECODE: Hex = ARTIFACT.deployedBytecode;

const SANDBOX_BALANCE = parseEther("1000"); // baseline; delta sign is invariant to baseline

/** Default watch set: watched tokens for balance deltas + allowance deltas vs the call target + allowlist. */
/** Build the sim watch set. `extraSpenders` MUST include the call's decoded approve spender
 *  (call.to on an approve is the TOKEN, not the grantee) so the allowance-delta detector actually
 *  measures the grant. Both arrays below are built TOKEN-MAJOR and stay index-aligned — the
 *  contract pairs allowanceTokens[i] with allowanceSpenders[i] element-wise (do not desync them). */
export function defaultWatchSet(target: Address, extraSpenders: Address[] = []): WatchSet {
  const allowanceSpenders = [target, ...extraSpenders, ...ALLOWLIST];
  const allowanceTokens = WATCHED_TOKENS.flatMap((t) => allowanceSpenders.map(() => t)); // token-major
  const flatSpenders = WATCHED_TOKENS.flatMap(() => allowanceSpenders);                  // token-major (aligned)
  return { tokens: WATCHED_TOKENS, allowanceTokens, allowanceSpenders: flatSpenders };
}

/** Run the BackstopSimulator at the account address via eth_call code-override. */
export async function simulate(account: Address, call: PendingCall, watch: WatchSet): Promise<SimResult> {
  const data = encodeFunctionData({
    abi: SIMULATOR_ABI,
    functionName: "simulate",
    args: [call.to, call.value, call.data, watch.tokens, watch.allowanceTokens, watch.allowanceSpenders],
  });

  // PRIMARY: viem call with stateOverride (override code + balance at the account address).
  try {
    const { data: ret } = await simRpc.call({
      to: account,
      data,
      stateOverride: [{ address: account, code: SIM_BYTECODE, balance: SANDBOX_BALANCE }],
    });
    return decode(ret as Hex);
  } catch (err) {
    // FALLBACK: raw eth_call (exactly the spike's proven path).
    return rawEthCall(account, data);
  }
}

async function rawEthCall(account: Address, data: Hex): Promise<SimResult> {
  const body = {
    jsonrpc: "2.0", id: 1, method: "eth_call",
    params: [
      { to: account, data, gas: "0x1C9C380" },
      "latest",
      { [account]: { code: SIM_BYTECODE, balance: "0x3635C9ADC5DEA00000" } }, // 1000 ether
    ],
  };
  const res = await fetch(PUBLIC_RPC_URL, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.error) throw new Error(`eth_call sim failed: ${json.error.message}`);
  return decode(json.result as Hex);
}

function decode(ret: Hex): SimResult {
  const r = decodeFunctionResult({ abi: SIMULATOR_ABI, functionName: "simulate", data: ret }) as {
    nativeSelfDelta: bigint; tokenSelfDeltas: readonly bigint[]; allowanceDeltas: readonly bigint[];
    execOk: boolean; returnData: Hex;
  };
  return {
    nativeSelfDelta: r.nativeSelfDelta,
    tokenSelfDeltas: [...r.tokenSelfDeltas],
    allowanceDeltas: [...r.allowanceDeltas],
    execOk: r.execOk,
    returnData: r.returnData,
  };
}
