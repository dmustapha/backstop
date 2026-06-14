// File: keeper/src/store.ts
import { readFileSync, writeFileSync } from "node:fs";
import type { VerdictDTO } from "../../shared/types";

type Listener = (v: VerdictDTO) => void;

// Best-effort persistence (wire hardening): the feed holds REAL on-chain verdicts, so a keeper
// restart mid-demo should not blank it. Verdicts are already JSON-safe (value/deltas are strings).
// All file I/O is wrapped — a disk error degrades to in-memory, it never breaks the verdict flow.
const PERSIST_PATH = process.env.VERDICT_STORE_PATH ?? `${process.cwd()}/.verdict-store.json`;
const MAX_ITEMS = 200;

class Store {
  private items: VerdictDTO[] = [];
  private listeners = new Set<Listener>();
  private seq = 0;

  constructor() {
    // Load the live persisted feed first; on a fresh host (no store yet) fall back to the
    // committed seed of real on-chain verdicts so a cold deploy boots with demo history.
    const SEED_PATH = `${process.cwd()}/keeper/seed-verdicts.json`;
    for (const path of [PERSIST_PATH, SEED_PATH]) {
      try {
        const raw = JSON.parse(readFileSync(path, "utf8")) as { seq?: number; items?: VerdictDTO[] };
        this.items = Array.isArray(raw.items) ? raw.items.slice(0, MAX_ITEMS) : [];
        this.seq = typeof raw.seq === "number" ? raw.seq : this.items.length;
        if (this.items.length) break;
      } catch { /* try next source, else start empty */ }
    }
  }

  private persist(): void {
    try { writeFileSync(PERSIST_PATH, JSON.stringify({ seq: this.seq, items: this.items })); }
    catch { /* best-effort: keep serving from memory */ }
  }

  add(v: Omit<VerdictDTO, "id" | "createdAt">): VerdictDTO {
    const full: VerdictDTO = { ...v, id: `v_${++this.seq}`, createdAt: Date.now() };
    this.items.unshift(full);
    if (this.items.length > MAX_ITEMS) this.items.pop();
    this.persist();
    for (const l of this.listeners) l(full);
    return full;
  }
  recent(limit = 50, account?: string): VerdictDTO[] {
    // defense in depth: a non-finite/negative limit reaching here falls back to 50 (server also sanitizes)
    const n = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 50;
    const list = account ? this.items.filter((i) => i.account.toLowerCase() === account.toLowerCase()) : this.items;
    return list.slice(0, n);
  }
  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}

export const store = new Store();
