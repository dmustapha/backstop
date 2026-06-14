// File: scripts/register-guardian.ts
import { type Hex } from "viem";
import { registerAgent, buildRegistrationFile, toDataUri } from "../sdk/src/erc8004";

async function main() {
  const key = process.env.GUARDIAN_KEY as Hex;
  if (!key) throw new Error("GUARDIAN_KEY missing");
  const file = buildRegistrationFile(
    "Backstop Guardian",
    "On-chain guardian that simulates and co-signs/vetoes autonomous AI agents' Mantle transactions.",
  );
  const { agentId, txHash } = await registerAgent(key, toDataUri(file));
  console.log(`[guardian] ERC-8004 agentId=${agentId} tx=${txHash}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
