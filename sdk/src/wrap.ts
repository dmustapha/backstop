// File: sdk/src/wrap.ts
import {
  createPublicClient, createWalletClient, http, parseAbi, decodeEventLog,
  type Address, type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mantleSepolia, RPC_URL, FACTORY, GUARDIAN_ADDRESS, KEEPER_URL, RECOVERY_DELAY_BLOCKS } from "../../shared/addresses";
import { FACTORY_ABI, ACCOUNT_ABI } from "../../shared/abis";
import { buildRegistrationFile, toDataUri } from "./erc8004";
import type { AgentIntent, ProposeResponse } from "../../shared/types";

export interface GuardedSigner {
  account: Address;          // the deployed BackstopAccount
  agentId: bigint;           // ERC-8004 identity
  ownerAddress: Address;     // the agent key address
  /** Propose a call: simulate→classify on the keeper; on COSIGN submit execute on-chain. */
  propose(to: Address, value: bigint, data: Hex, intent: AgentIntent): Promise<ProposeResult>;
}

export interface ProposeResult {
  decision: "COSIGN" | "VETO";
  txHash: Hex | null;        // CoSigned tx (cosign) or Blocked tx (veto)
  reasons: string[];
}

export interface WrapOpts {
  guardian?: Address;
  recoveryDelayBlocks?: bigint;
  name?: string;
  description?: string;
  keeperUrl?: string;
}

export async function wrap(agentKey: Hex, opts: WrapOpts = {}): Promise<GuardedSigner> {
  const ownerAccount = privateKeyToAccount(agentKey);
  const guardian = opts.guardian ?? GUARDIAN_ADDRESS;
  const recoveryDelayBlocks = opts.recoveryDelayBlocks ?? RECOVERY_DELAY_BLOCKS;
  const keeperUrl = opts.keeperUrl ?? KEEPER_URL;

  const pub = createPublicClient({ chain: mantleSepolia, transport: http(RPC_URL) });
  const wallet = createWalletClient({ account: ownerAccount, chain: mantleSepolia, transport: http(RPC_URL) });

  // 1. deploy + register via factory (idempotent per (owner, guardian) salt)
  const predicted = await pub.readContract({
    address: FACTORY, abi: FACTORY_ABI, functionName: "computeAddress",
    args: [ownerAccount.address, guardian, recoveryDelayBlocks],
  }) as Address;

  let account = predicted;
  let agentId = 0n;
  const code = await pub.getCode({ address: predicted });
  if (!code || code === "0x") {
    const regFile = buildRegistrationFile(
      opts.name ?? "Backstop-guarded agent",
      opts.description ?? "An autonomous agent whose wallet is guarded by Backstop.",
    );
    const txHash = await wallet.writeContract({
      address: FACTORY, abi: FACTORY_ABI, functionName: "createAccount",
      args: [ownerAccount.address, guardian, recoveryDelayBlocks, toDataUri(regFile)],
    });
    const receipt = await pub.waitForTransactionReceipt({ hash: txHash });
    for (const log of receipt.logs) {
      try {
        const ev = decodeEventLog({ abi: FACTORY_ABI, ...log });
        if (ev.eventName === "AccountCreated") {
          account = ev.args.account as Address;
          agentId = ev.args.agentId as bigint;
        }
      } catch { /* not ours */ }
    }
  }

  return {
    account, agentId, ownerAddress: ownerAccount.address,
    async propose(to, value, data, intent): Promise<ProposeResult> {
      // a) ask the keeper to simulate + classify
      const res = await fetch(`${keeperUrl}/propose`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account, to, value: value.toString(), data, intent }),
      });
      if (!res.ok) throw new Error(`keeper /propose failed: ${res.status}`);
      const out = (await res.json()) as ProposeResponse;

      if (out.decision === "VETO") {
        return { decision: "VETO", txHash: out.blockedTxHash, reasons: out.verdict.reasons };
      }

      // b) COSIGN → owner submits execute with the guardian co-signature
      const execHash = await wallet.writeContract({
        address: account, abi: ACCOUNT_ABI, functionName: "execute",
        args: [to, value, data, out.guardianSig],
      });
      await pub.waitForTransactionReceipt({ hash: execHash });
      return { decision: "COSIGN", txHash: execHash, reasons: out.verdict.reasons };
    },
  };
}
