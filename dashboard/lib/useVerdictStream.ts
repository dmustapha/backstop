// File: dashboard/lib/useVerdictStream.ts
"use client";
import { useEffect, useState } from "react";
import type { VerdictDTO } from "./types";
import { KEEPER_URL, fetchVerdicts } from "./api";

export function useVerdictStream(account?: string): VerdictDTO[] {
  const [items, setItems] = useState<VerdictDTO[]>([]);

  useEffect(() => {
    let alive = true;
    fetchVerdicts(50, account).then((v) => { if (alive) setItems(v); });

    const es = new EventSource(`${KEEPER_URL}/events`);
    es.onmessage = (e) => {
      try {
        const v = JSON.parse(e.data) as VerdictDTO;
        if (!v.id) return;
        if (account && v.account.toLowerCase() !== account.toLowerCase()) return;
        setItems((prev) => [v, ...prev].slice(0, 50));
      } catch { /* ping */ }
    };
    es.onerror = () => { /* browser auto-reconnects */ };
    return () => { alive = false; es.close(); };
  }, [account]);

  return items;
}
