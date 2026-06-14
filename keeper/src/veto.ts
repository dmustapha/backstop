// File: keeper/src/veto.ts
import { type Address, type Hex } from "viem";
import { wallet, pub } from "./clients";
import { ACCOUNT_ABI } from "../../shared/abis";

/** Submit guardianVeto on-chain → emits Blocked. Returns the tx hash. */
export async function submitVeto(
  account: Address, nonce: bigint, to: Address, callHash: Hex, reason: string,
): Promise<Hex> {
  const hash = await wallet.writeContract({
    address: account, abi: ACCOUNT_ABI, functionName: "guardianVeto",
    args: [nonce, to, callHash, reason.slice(0, 200)],
  });
  await pub.waitForTransactionReceipt({ hash });
  return hash;
}
