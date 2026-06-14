// File: sdk/src/erc8004.ts
import {
  createPublicClient, createWalletClient, http, parseAbi, parseEventLogs,
  type Address, type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mantleSepolia, IDENTITY_REGISTRY, RPC_URL } from "../../shared/addresses";

const REGISTRY_ABI = parseAbi([
  "function register(string agentURI) returns (uint256 agentId)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
]);

export interface RegistrationFile {
  type: string;
  name: string;
  description: string;
  image?: string;
  services?: { name: string; endpoint: string }[];
  registrations: { agentId: number; agentRegistry: string }[];
  supportedTrust: string[];
}

/** Build the ERC-8004 registration JSON. `type` MUST be the exact EIP string. */
export function buildRegistrationFile(name: string, description: string, agentId = 0): RegistrationFile {
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name,
    description,
    registrations: [
      { agentId, agentRegistry: `eip155:5003:${IDENTITY_REGISTRY}` },
    ],
    supportedTrust: [], // empty = discovery-only; we avoid the unstable Validation registry
  };
}

/** Encode a registration file as a data: URI (IPFS-free fallback — fully on-chain metadata). */
export function toDataUri(file: RegistrationFile): string {
  const json = JSON.stringify(file);
  return `data:application/json;base64,${Buffer.from(json).toString("base64")}`;
}

/** Register an identity. Returns the agentId (ERC-721 tokenId). */
export async function registerAgent(privKey: Hex, agentURI: string): Promise<{ agentId: bigint; txHash: Hex }> {
  const account = privateKeyToAccount(privKey);
  const wallet = createWalletClient({ account, chain: mantleSepolia, transport: http(RPC_URL) });
  const pub = createPublicClient({ chain: mantleSepolia, transport: http(RPC_URL) });

  const txHash = await wallet.writeContract({
    address: IDENTITY_REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "register",
    args: [agentURI],
  });
  const receipt = await pub.waitForTransactionReceipt({ hash: txHash });

  // decode the Registered event to read the minted agentId
  const events = parseEventLogs({ abi: REGISTRY_ABI, eventName: "Registered", logs: receipt.logs });
  const agentId = events.length > 0 ? (events[0].args.agentId as bigint) : 0n;

  return { agentId, txHash };
}

/** Resolve agentIds owned by `owner` via the Registered event index (no on-chain reverse getter). */
export async function resolveAgentIds(owner: Address, fromBlock: bigint = 0n): Promise<bigint[]> {
  const pub = createPublicClient({ chain: mantleSepolia, transport: http(RPC_URL) });
  const logs = await pub.getLogs({
    address: IDENTITY_REGISTRY,
    event: REGISTRY_ABI[1], // Registered
    args: { owner },
    fromBlock,
    toBlock: "latest",
  });
  return logs.map((l) => (l as unknown as { args: { agentId: bigint } }).args.agentId);
}
