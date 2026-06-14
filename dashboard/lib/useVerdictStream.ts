// File: dashboard/lib/useVerdictStream.ts
"use client";
import { useEffect, useState } from "react";
import type { VerdictDTO } from "./types";
import { KEEPER_URL, fetchVerdicts } from "./api";

export function useVerdictStream(account?: string): VerdictDTO[] {
  const [items, setItems] = useState<VerdictDTO[]>([]);

  useEffect(() => {
    let alive = true;
    let retry: ReturnType<typeof setTimeout> | undefined;

    // Cold-start cover: Render's free tier sleeps after ~15 min idle and takes ~50s to wake. During
    // that window fetchVerdicts() returns [] (the keeper isn't answering yet). Instead of leaving the
    // feed on its empty state until a manual reload, keep re-fetching until the keeper responds — the
    // feed then self-populates. SSE handles live pushes once it's up.
    let attempt = 0;
    const load = () => {
      fetchVerdicts(50, account).then((v) => {
        if (!alive) return;
        if (v.length) { setItems(v); return; }
        if (attempt++ < 20) retry = setTimeout(load, 3000); // ~60s of cold-start cover
      });
    };
    load();

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
    return () => { alive = false; if (retry) clearTimeout(retry); es.close(); };
  }, [account]);

  return items;
}
