// File: dashboard/app/proof/page.tsx — Exhibits of record (product framing, zero hackathon).
import { txLink, addrLink } from "../../lib/api";
import { CopyButton } from "../../components/CopyButton";

// Submission proof — hardcoded on-chain artifacts (Mantle Sepolia, chainId 5003).
// Every hash/address here is real and verified; see submission/proof.md for the source list.

const CONTRACTS: { label: string; addr: string; note?: string }[] = [
  { label: "BackstopAccountFactory", addr: "0x46BA593Cd94a96ba6B6cbfA90681e8952935bEd7", note: "LIVE · Sourcify-verified" },
  { label: "ERC-8004 IdentityRegistry", addr: "0x8004A818BFB912233c491871b3d84c89A494BD9e", note: "on-chain registry" },
  { label: "Demo guarded account", addr: "0x42D7bb229f0aB8BBEd38C7B2Fd974892F6B28919", note: "BackstopAccount · agentId 183" },
  { label: "Demo unknown contract (#5)", addr: "0xbc8ff91717e526fbe5c7fa347da102b0531ebb33", note: "has bytecode" },
  { label: "Demo drainer", addr: "0x088bA48aaAf93D53d6FFD7957a65d928995fDD65", note: "in known-drainer list" },
  { label: "Demo injected spender (#6)", addr: "0x18bf06FB248Bd12D80734F4E49b0Ef743Bd151B8", note: "clean-floor stranger" },
];

const IDENTITIES: { label: string; agentId: string; owner: string }[] = [
  { label: "Guardian", agentId: "182", owner: "0x774aD9B068DfA18B79FEB371ABd930e4Af7159CB" },
  { label: "Guarded account (agent)", agentId: "183", owner: "0xe90BE5e145f6B150BA59476c22Ccf9498587B4bD" },
];

const BEATS: { n: string; label: string; decision: "VETO" | "COSIGN"; detail: string; tx: string; star?: boolean }[] = [
  { n: "1", label: "malicious-approve → flagged drainer", decision: "VETO", detail: "Tier-A · known-drainer list", tx: "0x53e43348a74799c7aedf717991b56e94e8a9766ee3941eeee3a1218b5f549b63" },
  { n: "2", label: "legit swap on Agni (settled)", decision: "COSIGN", detail: "FLOOR · CoSigned on-chain", tx: "0x37f8ef0eae66edd62353012e4b3ea8b1cb9030d7112b4180fb8d363588ae5f74" },
  { n: "5", label: "unknown-contract intent", decision: "VETO", detail: "Tier-B · judged by: altllm", tx: "0xf83a34f4ea3fee884df8125f5b6788c140a4d6a3951483e87c965bc9d223673a" },
  { n: "6", label: "intent ↔ calldata mismatch", decision: "VETO", detail: "Tier-B · judged by: altllm", tx: "0xca732869fc64ca229f4f424a55953a0613ac8db49f3675e2cfe22a50b363098d", star: true },
];

// Exhibit D — a brand-new agent onboarded LIVE against the hosted guardian (scripts/onboard-fresh.ts).
// Proves Mode A end-to-end: a never-seen key is wrapped on-chain, then immediately guarded.
const ONBOARD: { label: string; note: string; value: string; kind: "addr" | "tx" }[] = [
  { label: "Fresh agent key — never seen before", note: "owner", value: "0xe704Fb38619732f3990966E72A84050e0Ba1177D", kind: "addr" },
  { label: "Guarded account deployed live", note: "BackstopAccount · ERC-8004 agentId 216", value: "0xa36Aa5C4402C229ad6Ef50D1f2A58DB5ACC4DE96", kind: "addr" },
  { label: "Drainer proposed → VETO", note: "on-chain Blocked · guardian-paid", value: "0x3620cebfb636d7a30f71c680260c96da7232ffed828a010bd5ed59cce9451fb5", kind: "tx" },
  { label: "Legit call proposed → COSIGN", note: "on-chain execute · agent-paid", value: "0xb2ba570909e5e74f14f8b90b9c434a4bd9a792db84628e1d8015d2e8e117f451", kind: "tx" },
];

// Product-framed proof points — what the system demonstrates (no track/hackathon references).
const PROVES: { title: string; body: string }[] = [
  { title: "A reusable guardian primitive", body: "backstop.wrap() adds a veto-only co-signer to any agent in about three lines — the guarding logic is a drop-in, not a fork." },
  { title: "Identity on both sides", body: "ERC-8004 registration for the guardian (agentId 182) and the guarded agent (agentId 183), each verifiable on-chain." },
  { title: "Evidence, not assertion", body: "Every verdict shows the simulated balance and allowance movement that justified it — the delta is the argument." },
  { title: "The save that matters", body: "The intent↔calldata mismatch (#6) is a real drain stopped before a single wei left the wallet — caught by an LLM, blocked on-chain." },
];

function short(a: string) {
  return `${a.slice(0, 10)}…${a.slice(-6)}`;
}

function ProofRow({ label, note, addr, last }: { label: string; note?: string; addr: string; last?: boolean }) {
  return (
    <div className={`${last ? "" : "rule-b "}grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-4 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_auto_auto]`}>
      <div>
        <div className="text-[.92rem]" style={{ color: "var(--ink)" }}>{label}</div>
        {note && <div className="caps" style={{ marginTop: ".15rem" }}>{note}</div>}
      </div>
      <div className="mono col-span-2 truncate text-[.8rem] sm:col-span-1" style={{ color: "var(--ink-dim)" }} title={addr}>
        {short(addr)}
      </div>
      <CopyButton value={addr} />
      <a className="exlink mono text-[.74rem]" href={addrLink(addr)} target="_blank" rel="noreferrer">explorer ↗</a>
    </div>
  );
}

export default function Proof() {
  return (
    <section className="mx-auto max-w-[1140px] px-6 py-24">
      <p className="section-tag">On-chain proof</p>
      <h1 className="serif mt-2" style={{ fontSize: "clamp(1.9rem,4vw,3rem)" }}>Exhibits of record</h1>
      <p className="measure mt-3" style={{ color: "var(--ink-dim)", maxWidth: "62ch", lineHeight: 1.6 }}>
        Every artifact below is real and verified on Mantle Sepolia (chainId 5003). No demo state is
        fabricated — each veto and co-sign lands a real <span className="mono">Blocked</span> /{" "}
        <span className="mono">CoSigned</span> event.
      </p>

      {/* Exhibit A · Contracts */}
      <div className="mt-12">
        <p className="caps mb-1">Exhibit A · Contracts</p>
        <div className="filing mt-3 overflow-hidden">
          {CONTRACTS.map((c, i) => (
            <ProofRow key={c.addr} label={c.label} note={c.note} addr={c.addr} last={i === CONTRACTS.length - 1} />
          ))}
        </div>
      </div>

      {/* Exhibit B · Identities */}
      <div className="mt-10">
        <p className="caps mb-1">Exhibit B · ERC-8004 identities (both sides)</p>
        <div className="filing mt-3 overflow-hidden">
          {IDENTITIES.map((id, i) => (
            <ProofRow key={id.owner} label={`${id.label} · agentId ${id.agentId}`} note="owner" addr={id.owner} last={i === IDENTITIES.length - 1} />
          ))}
        </div>
      </div>

      {/* Exhibit C · Detection beats */}
      <div className="mt-10">
        <p className="caps mb-1">Exhibit C · Detection beats (real txs)</p>
        <div className="filing mt-3 overflow-hidden">
          {BEATS.map((b, i) => {
            const veto = b.decision === "VETO";
            return (
              <div key={b.n} className={`${i < BEATS.length - 1 ? "rule-b " : ""}grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4`}>
                <div className="shrink-0">
                  <span className="exhibit-no">№{b.n}{b.star ? " ★" : ""}</span>
                  <span className={`pill ${veto ? "pill-veto" : "pill-ok"}`} style={{ marginLeft: ".5rem" }}>{b.decision}</span>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[.92rem]" style={{ color: "var(--ink)" }}>{b.label}</div>
                  <div className="caps" style={{ marginTop: ".15rem" }}>{b.detail}</div>
                </div>
                <a className="exlink mono text-[.74rem]" href={txLink(b.tx)} target="_blank" rel="noreferrer">
                  {short(b.tx)} ↗
                </a>
              </div>
            );
          })}
        </div>
      </div>

      {/* Exhibit D · Live onboarding proof */}
      <div className="mt-10">
        <p className="caps mb-1">Exhibit D · Live onboarding (a fresh agent, wrapped on-chain)</p>
        <div className="filing mt-3 overflow-hidden">
          {ONBOARD.map((o, i) => (
            <div key={o.value} className={`${i < ONBOARD.length - 1 ? "rule-b " : ""}grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto]`}>
              <div>
                <div className="text-[.92rem]" style={{ color: "var(--ink)" }}>{o.label}</div>
                <div className="caps" style={{ marginTop: ".15rem" }}>{o.note}</div>
              </div>
              <div className="mono truncate text-[.8rem]" style={{ color: "var(--ink-dim)" }} title={o.value}>{short(o.value)}</div>
              <a className="exlink mono text-[.74rem]" href={o.kind === "tx" ? txLink(o.value) : addrLink(o.value)} target="_blank" rel="noreferrer">explorer ↗</a>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[.8rem]" style={{ color: "var(--ink-faint)", lineHeight: 1.6 }}>
          Reproduce it: <span className="mono">node --env-file=.env --import tsx scripts/onboard-fresh.ts</span> wraps
          a new key against the hosted guardian and prints these exact hashes.
        </p>
      </div>

      {/* What this proves (product framing) */}
      <div className="mt-12">
        <p className="caps mb-1">What this proves</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {PROVES.map((p) => (
            <div key={p.title} className="filing p-6">
              <h3 className="serif" style={{ fontSize: "1.3rem", lineHeight: 1.1 }}>{p.title}</h3>
              <p className="prose-measure mt-2 text-[.9rem]" style={{ color: "var(--ink-dim)", lineHeight: 1.6 }}>{p.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-[.82rem]" style={{ color: "var(--ink-faint)", lineHeight: 1.6 }}>
          In short: a veto-only co-signer with ERC-8004 identity on both sides (agentId 182 + 183), proven{" "}
          <span className="mono">wrap()</span> onboarding — a brand-new agent (agentId 216) wrapped and guarded
          live on-chain, drainer vetoed and legit call co-signed in the same run.
        </p>
      </div>
    </section>
  );
}
