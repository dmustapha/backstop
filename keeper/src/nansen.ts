// File: keeper/src/nansen.ts
import type { Address } from "viem";
import { STATIC_DRAINERS } from "../../shared/addresses";

export interface LabelResult {
  flagged: boolean;
  source: "nansen" | "static" | "none";
  labels: string[];
}

const DRAINER_HINTS = ["drainer", "scam", "phish", "exploit", "malicious", "hack"];

/** Look up malicious labels for an address. Nansen live (if key present) → static fallback. */
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
    } catch { /* fall through to static */ }
  }
  // static fallback (always works)
  const isStatic = STATIC_DRAINERS.map((a) => a.toLowerCase()).includes(addr.toLowerCase());
  return { flagged: isStatic, source: isStatic ? "static" : "none", labels: isStatic ? ["static:known-drainer"] : [] };
}
