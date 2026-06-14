// File: dashboard/components/PasteTxPanel.tsx
"use client";
import { useEffect, useState } from "react";
import { simulateTx } from "../lib/api";
import type { VerdictDTO } from "../lib/types";
import { VerdictCard } from "./VerdictCard";
import { Seal } from "./Seal";

const DEMO_ACCOUNT = process.env.NEXT_PUBLIC_DEMO_ACCOUNT ?? "";

// [D-1a] Tier-B verdicts take 8–15s (real LLM inference). The busy pane cycles these
// forensic step-lines so the wait reads intentional, not frozen.
const STEPS = [
  "eth_call · code-override · simulating live state",
  "tracing token transfers · WMNT / USDC",
  "weighing stated intent against calldata",
  "escalating to Tier-B · judged by: altllm · writing opinion…",
];

export function PasteTxPanel() {
  const [account, setAccount] = useState(DEMO_ACCOUNT);
  const [to, setTo] = useState("");
  const [value, setValue] = useState("0");
  const [data, setData] = useState("0x");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VerdictDTO | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!busy) return;
    setStep(0);
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 2400);
    return () => clearInterval(t);
  }, [busy]);

  async function run() {
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const v = await simulateTx({ account, to, value, data });
      setResult(v);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_1.1fr]">
      {/* input */}
      <form
        className="filing p-7"
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <div className="grid gap-5">
          <Field id="acct" label="Guarded account" v={account} set={setAccount} />
          <Field id="to" label="To (any address)" v={to} set={setTo} placeholder="0x…" />
          <div className="grid grid-cols-2 gap-4">
            <Field id="val" label="Value (wei)" v={value} set={setValue} />
            <Field id="cd" label="Calldata" v={data} set={setData} placeholder="0x…" />
          </div>
          <button type="submit" className="btn-run mt-1" disabled={busy || !to || !account}>
            {busy ? "Simulating live on Mantle…" : "Run real simulation"}
          </button>
          <p className="text-[.72rem]" style={{ color: "var(--ink-faint)" }}>
            Tier-B verdicts call a live LLM — expect 8–15s while the opinion is written.
          </p>
        </div>
      </form>

      {/* result area */}
      <div className="min-h-[320px]">
        {busy ? (
          <div className="filing grid h-full place-items-center p-10 text-center">
            <div>
              <svg className="spinner-seal mx-auto" viewBox="0 0 60 60" aria-hidden="true">
                <circle className="spinner-track" cx="30" cy="30" r="24" />
                <circle cx="30" cy="30" r="24" />
              </svg>
              <p className="serif mt-6 text-[1.5rem]">Analyzing on Mantle…</p>
              <p className="mono mt-2 text-[.78rem]" style={{ color: "var(--ink-dim)" }}>{STEPS[step]}</p>
              <p className="caps mt-4 inline-flex items-center gap-2">
                <span className="dot pip" style={{ background: "var(--seal)" }} />
                live simulation · real inference
              </p>
            </div>
          </div>
        ) : err ? (
          <div className="filing grid h-full place-items-center p-10 text-center" style={{ borderColor: "color-mix(in oklab,var(--veto) 50%,var(--rule))" }}>
            <div>
              <p className="caps" style={{ color: "var(--veto-ink)" }}>Simulation error</p>
              <p className="mono mt-3 text-[.82rem]" style={{ color: "var(--ink-dim)" }}>{err}</p>
            </div>
          </div>
        ) : result ? (
          <VerdictCard v={result} starred />
        ) : (
          <div className="filing grid h-full place-items-center p-10 text-center" style={{ borderStyle: "dashed" }}>
            <div>
              <Seal size={64} className="mx-auto" style={{ opacity: 0.5 }} />
              <p className="caps mt-5">Awaiting filing</p>
              <p className="mt-2 text-[.86rem]" style={{ color: "var(--ink-dim)" }}>
                Run a simulation and the verdict is entered here.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ id, label, v, set, placeholder }: {
  id: string; label: string; v: string; set: (s: string) => void; placeholder?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} value={v} onChange={(e) => set(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
