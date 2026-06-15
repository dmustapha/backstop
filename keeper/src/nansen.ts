// File: keeper/src/nansen.ts
import type { Address } from "viem";
import { STATIC_DRAINERS } from "../../shared/addresses";
import { lookupDrainer } from "./drainerList";

export interface LabelResult {
  flagged: boolean;
  source: "nansen" | "ethereum-lists" | "static" | "none";
  labels: string[];
}

const DRAINER_HINTS = ["drainer", "scam", "phish", "exploit", "malicious", "hack"];

/**
 * Look up malicious labels for an address. Resolution order:
 *   1. Nansen live (only if NANSEN_API_KEY present) — paid upgrade, [UNVERIFIED] endpoint, non-load-bearing.
 *   2. Bundled known-drainer list — sourced from ethereum-lists (MIT), ~700 real flagged addresses.
 *   3. STATIC_DRAINERS env (the demo drainer + any operator-pinned addresses).
 * Live upgrade path (documented, no key needed): GoPlus address_security on Mantle 5000.
 */
export async function labelAddress(addr: Address): Promise<LabelResult> {
  const key = process.env.NANSEN_API_KEY;
  if (key) {
    try {
      // [UNVERIFIED] exact Nansen label endpoint — fallback path makes this non-load-bearing.
      const res = await fetch(`https://api.nansen.ai/v1/address/${addr}/labels`, {
        headers: { "apiKey": key },
        signal: AbortSignal.timeout(2500),
      });
      if (res.ok) {
        const json = (await res.json()) as { labels?: { label: string; category?: string }[] };
        const labels = (json.labels ?? []).map((l) => `${l.category ?? ""}:${l.label}`.toLowerCase());
        const flagged = labels.some((l) => DRAINER_HINTS.some((h) => l.includes(h)));
        return { flagged, source: "nansen", labels };
      }
    } catch { /* fall through to the offline list */ }
  }

  // bundled known-drainer list (ethereum-lists, MIT) — the real sourced threat intel
  const listed = lookupDrainer(addr);
  if (listed.flagged) {
    return {
      flagged: true,
      source: "ethereum-lists",
      labels: [`known-drainer:ethereum-lists${listed.comment ? ` (${listed.comment})` : ""}`],
    };
  }

  // operator/demo static list (the seeded demo drainer lives here)
  const isStatic = STATIC_DRAINERS.map((a) => a.toLowerCase()).includes(addr.toLowerCase());
  return { flagged: isStatic, source: isStatic ? "static" : "none", labels: isStatic ? ["static:known-drainer"] : [] };
}
