// File: dashboard/lib/api.ts
import type { VerdictDTO } from "./types";

export const KEEPER_URL = process.env.NEXT_PUBLIC_KEEPER_URL ?? "http://localhost:8787";
export const EXPLORER = "https://sepolia.mantlescan.xyz";

export async function fetchVerdicts(limit = 50, account?: string): Promise<VerdictDTO[]> {
  const u = new URL(`${KEEPER_URL}/verdicts`);
  u.searchParams.set("limit", String(limit));
  if (account) u.searchParams.set("account", account);
  const res = await fetch(u.toString(), { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export async function simulateTx(input: {
  account: string; to: string; value: string; data: string;
  intent?: { statedGoal: string; expectedTargets: string[] };
}): Promise<VerdictDTO> {
  const res = await fetch(`${KEEPER_URL}/simulate`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`simulate failed: ${res.status}`);
  return res.json();
}

export const txLink = (h: string) => `${EXPLORER}/tx/${h}`;
export const addrLink = (a: string) => `${EXPLORER}/address/${a}`;
