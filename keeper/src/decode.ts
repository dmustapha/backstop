// File: keeper/src/decode.ts
import { decodeFunctionData, slice, type Address, type Hex } from "viem";
import { ERC20_ABI, AGNI_ROUTER_ABI } from "../../shared/abis";
import type { DecodedCall, PendingCall } from "../../shared/types";

/** Decode a pending call into a known function + the addresses value would flow to. */
export function decodeCall(call: PendingCall): DecodedCall {
  const selector = (call.data.length >= 10 ? slice(call.data, 0, 4) : "0x") as Hex;
  const base: DecodedCall = {
    selector, functionName: null, args: null, recipients: [], spender: null, approvalAmount: null,
  };

  // ERC-20 surface (call.to is the token contract)
  try {
    const d = decodeFunctionData({ abi: ERC20_ABI, data: call.data });
    if (d.functionName === "approve" || d.functionName === "increaseAllowance") {
      const [spender, amount] = d.args as [Address, bigint];
      return { ...base, functionName: d.functionName, args: d.args, spender, approvalAmount: amount, recipients: [] };
    }
    if (d.functionName === "transfer") {
      const [to] = d.args as [Address, bigint];
      return { ...base, functionName: d.functionName, args: d.args, recipients: [to] };
    }
    if (d.functionName === "transferFrom") {
      const [, to] = d.args as [Address, Address, bigint];
      return { ...base, functionName: d.functionName, args: d.args, recipients: [to] };
    }
  } catch { /* not an ERC-20 call */ }

  // Agni swap (call.to is the router → recipient is in the struct; outflow goes to router)
  try {
    const d = decodeFunctionData({ abi: AGNI_ROUTER_ABI, data: call.data });
    if (d.functionName === "exactInputSingle") {
      // DEV-002: viem 2.52 infers a precise readonly tuple for d.args; cast through `unknown` to read
      // the recipient field (type-only; the runtime value is unchanged). ARCHITECTURE §9 used a direct cast.
      const p = (d.args as unknown as [{ recipient: Address }])[0];
      return { ...base, functionName: d.functionName, args: d.args, recipients: [call.to, p.recipient] };
    }
  } catch { /* not a swap */ }

  // unknown selector: recipients unknown (handled conservatively by the classifier)
  return base;
}
