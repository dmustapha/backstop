// File: keeper/src/cosign.ts
import { keccak256, encodeAbiParameters, type Address, type Hex } from "viem";
import { guardianAccount, pub } from "./clients";
import { ACCOUNT_ABI } from "../../shared/abis";
import { CHAIN_ID } from "../../shared/addresses";
import type { PendingCall } from "../../shared/types";

const CALL_TYPES = {
  Call: [
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "data", type: "bytes" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

export async function readNonce(account: Address): Promise<bigint> {
  return (await pub.readContract({ address: account, abi: ACCOUNT_ABI, functionName: "nonce" })) as bigint;
}

/** Produce the guardian's EIP-712 co-signature over (to,value,data,nonce). */
export async function cosign(account: Address, call: PendingCall, nonce: bigint): Promise<Hex> {
  return guardianAccount.signTypedData({
    domain: { name: "Backstop", version: "1", chainId: CHAIN_ID, verifyingContract: account },
    types: CALL_TYPES,
    primaryType: "Call",
    message: { to: call.to, value: call.value, data: call.data, nonce },
  });
}

/** callHash recorded on-chain by guardianVeto (matches keccak256(abi.encode(to,value,data,nonce))). */
export function callHash(call: PendingCall, nonce: bigint): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }, { type: "bytes" }, { type: "uint256" }],
      [call.to, call.value, call.data, nonce],
    ),
  );
}
