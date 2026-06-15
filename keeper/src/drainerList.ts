// File: keeper/src/drainerList.ts
// Bundled known-drainer list — sourced from ethereum-lists (MyEtherWallet), MIT-licensed.
// This is the keeper's offline threat-intel fallback: 652 real EVM addresses flagged for
// phishing/scam/drainer activity. It is NOT a live oracle. The documented live upgrade path is
// GoPlus address_security (free, no-key, supports Mantle 5000) → Nansen (paid). See keeper/src/nansen.ts.
import { readFileSync } from "node:fs";
import type { Address } from "viem";

interface DrainerFile {
  source: string;
  license: string;
  sourceUrl: string;
  fetchedAt: string;
  count: number;
  entries: Record<string, string>; // lowercased address → short comment
}

// Loaded once at module init (same pattern as simulator.ts sim-bytecode.json).
const data: DrainerFile = JSON.parse(
  readFileSync(new URL("../data/known-drainers.json", import.meta.url), "utf8"),
) as DrainerFile;

const entries: Record<string, string> = data.entries ?? {};

export const DRAINER_LIST_SOURCE = data.source;
export const DRAINER_LIST_LICENSE = data.license;
export const DRAINER_COUNT = Object.keys(entries).length;

/** O(1) lookup against the bundled list. Returns the matched comment (honest provenance) or null. */
export function lookupDrainer(addr: Address): { flagged: boolean; comment: string | null } {
  const hit = entries[addr.toLowerCase()];
  return hit !== undefined ? { flagged: true, comment: hit || null } : { flagged: false, comment: null };
}
