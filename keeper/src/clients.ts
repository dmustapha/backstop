// File: keeper/src/clients.ts
import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mantleSepolia, RPC_URL, PUBLIC_RPC_URL } from "../../shared/addresses";

if (!process.env.GUARDIAN_KEY) throw new Error("GUARDIAN_KEY missing");
export const guardianAccount = privateKeyToAccount(process.env.GUARDIAN_KEY as `0x${string}`);

// Active reads/writes via 3rd-party RPC (public RPC is rate-limited under polling).
export const pub = createPublicClient({ chain: mantleSepolia, transport: http(RPC_URL) });
// Simulation override always works on the public RPC.
export const simRpc = createPublicClient({ chain: mantleSepolia, transport: http(PUBLIC_RPC_URL) });
export const wallet = createWalletClient({ account: guardianAccount, chain: mantleSepolia, transport: http(RPC_URL) });

export const GUARDIAN: Address = guardianAccount.address;
