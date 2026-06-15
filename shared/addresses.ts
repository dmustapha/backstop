// File: shared/addresses.ts
import { defineChain, type Address } from "viem";

export const RPC_URL = process.env.MANTLE_RPC_URL ?? "https://rpc.sepolia.mantle.xyz";
export const PUBLIC_RPC_URL = "https://rpc.sepolia.mantle.xyz"; // eth_call sim always works here
// Onboarding default = the HOSTED Backstop guardian keeper (Mode A: zero infra, trust the hosted
// guardian). A self-hosted guardian (Mode B: trustless) overrides via KEEPER_URL or wrap({ keeperUrl }).
// Local-only dev sets KEEPER_URL=http://localhost:8787 in .env.
export const KEEPER_URL = process.env.KEEPER_URL ?? "https://backstop-keeper.onrender.com";
export const CHAIN_ID = 5003;

export const mantleSepolia = defineChain({
  id: 5003,
  name: "Mantle Sepolia",
  nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.sepolia.mantle.xyz"] } },
  blockExplorers: { default: { name: "MantleScan", url: "https://sepolia.mantlescan.xyz" } },
  testnet: true,
});

// ERC-8004
export const IDENTITY_REGISTRY: Address = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
export const IDENTITY_REGISTRY_MAINNET: Address = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";

// Agni (allowlisted DEX)
export const AGNI_ROUTER: Address = "0xe38cfa32cCd918d94E2e20230dFaD1A4Fd8aEF16";
export const AGNI_QUOTER: Address = "0x9Da17239a4170f50A5A2c11813BD0C601b5c9693";
export const AGNI_FACTORY: Address = "0xA9AcD50B042A72c33d05fDcC8ad209d3aD361762";

// tokens
export const WMNT: Address = "0x67A1f4A939b477A6b7c5BF94D97E45dE87E608eF";
export const USDC: Address = "0xAcab8129E2cE587fD203FD770ec9ECAFA2C88080";
export const USDT: Address = "0xcc4ac915857532ada58d69493554c6d869932fe6";
export const WMNT_USDC_POOL: Address = "0xCe8B3Bd008A7fFD1E53756a40ee81AC914a3831D";

// deployed by this build (filled by Deploy.s.sol → write into .env → re-export here)
export const FACTORY: Address = (process.env.FACTORY_ADDRESS as Address) ?? "0x0000000000000000000000000000000000000000";
export const GUARDIAN_ADDRESS: Address = (process.env.GUARDIAN_ADDRESS as Address) ?? "0x0000000000000000000000000000000000000000";
export const RECOVERY_DELAY_BLOCKS: bigint = BigInt(process.env.RECOVERY_DELAY_BLOCKS ?? "150"); // ~5 min @ 2s blocks

// allowlist for the classifier: known-safe targets that may receive outflow
export const ALLOWLIST: Address[] = [AGNI_ROUTER, AGNI_QUOTER, WMNT_USDC_POOL, WMNT, USDC, USDT];

// the set of tokens the simulator watches by default
export const WATCHED_TOKENS: Address[] = [WMNT, USDC, USDT];

// static known-drainer list (Nansen fallback). 0xEVIL demo target appended by seed-demo via env.
export const STATIC_DRAINERS: Address[] = (
  (process.env.STATIC_DRAINERS ?? "").split(",").map((s) => s.trim()).filter(Boolean) as Address[]
);

export function explorerTx(hash: string): string {
  return `https://sepolia.mantlescan.xyz/tx/${hash}`;
}
export function explorerAddr(addr: string): string {
  return `https://sepolia.mantlescan.xyz/address/${addr}`;
}
