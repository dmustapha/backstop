// File: keeper/src/server.ts
import { createServer } from "node:http";
import { type Address, type Hex } from "viem";
import { classify } from "./classifier";
import { decodeCall } from "./decode";
import { simulate, defaultWatchSet } from "./simulator";
import { cosign, callHash, readNonce } from "./cosign";
import { submitVeto } from "./veto";
import { store } from "./store";
import type { PendingCall, ProposeRequest, SimulateRequest, Verdict, VerdictDTO } from "../../shared/types";

const PORT = Number(process.env.PORT ?? process.env.KEEPER_PORT ?? 8787);

// [debug fix #5] Per-account serialization lock for the cosign/veto critical section. Two concurrent
// /propose calls for the same account would otherwise both read the same on-chain nonce and receive
// guardian co-signatures over it (a TOCTOU race). Chaining proposes per account guarantees each reads
// a fresh nonce after the prior one's cosign/veto completes. Keyed by account; other accounts run free.
const accountLocks = new Map<string, Promise<unknown>>();
function withAccountLock<T>(account: string, fn: () => Promise<T>): Promise<T> {
  const key = account.toLowerCase();
  const prev = accountLocks.get(key) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  accountLocks.set(key, next.catch(() => {}));
  return next;
}

function dto(account: Address, call: PendingCall, v: Verdict, txHash: Hex | null): Omit<VerdictDTO, "id" | "createdAt"> {
  return {
    account, to: call.to, value: call.value.toString(), data: call.data,
    decision: v.decision, tier: v.tier, reasons: v.reasons,
    deltas: {
      nativeSelfDelta: v.deltas.nativeSelfDelta.toString(),
      tokenSelfDeltas: v.deltas.tokenSelfDeltas.map(String),
      allowanceDeltas: v.deltas.allowanceDeltas.map(String),
      execOk: v.deltas.execOk,
    },
    llm: v.llm ?? null, confidence: v.confidence, txHash,
  };
}

async function readRaw(req: import("node:http").IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString();
}
function parseJson(raw: string): { ok: true; value: any } | { ok: false } {
  try { return { ok: true, value: JSON.parse(raw || "{}") }; } catch { return { ok: false }; }
}

// [stress fix #1] Input validation at the edge. Before this, malformed input (bad address, non-numeric
// value, invalid hex, malformed JSON) crashed downstream (viem/RPC) and leaked a raw 500 with internal
// stack detail — visible to anyone in the "paste any tx" sandbox that literally invites "try to break it".
// Now: a clean 400 with a friendly message; the happy path (4 detection beats) is unchanged.
const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const HEX_RE = /^0x([0-9a-fA-F]{2})*$/;
function badRequest(res: import("node:http").ServerResponse, msg: string): void {
  res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ error: msg }));
}
/** Returns a friendly error string if the call body is invalid, else null. Normalizes empty data → 0x. */
function validateCallBody(b: any): string | null {
  if (!b || typeof b !== "object") return "body must be a JSON object";
  if (!ADDR_RE.test(String(b.account ?? ""))) return "account must be a 0x-prefixed 20-byte address";
  if (!ADDR_RE.test(String(b.to ?? ""))) return "to must be a 0x-prefixed 20-byte address";
  const data = b.data === "" || b.data == null ? "0x" : b.data;
  if (typeof data !== "string" || !HEX_RE.test(data)) return "data must be 0x-prefixed even-length hex";
  try { if (BigInt(b.value ?? "0") < 0n) return "value must be a non-negative integer (wei)"; }
  catch { return "value must be an integer (wei) string"; }
  return null;
}
/** Build a PendingCall from a validated body, normalizing empty/missing fields. */
function toCall(b: any): PendingCall {
  return { to: b.to, value: BigInt(b.value ?? "0"), data: b.data === "" || b.data == null ? "0x" : b.data };
}

const server = createServer(async (req, res) => {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "content-type");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }

  try {
    // ---- SSE verdict stream ----
    if (req.method === "GET" && req.url?.startsWith("/events")) {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      res.write(`event: ping\ndata: {}\n\n`);
      const unsub = store.subscribe((v) => res.write(`data: ${JSON.stringify(v)}\n\n`));
      req.on("close", unsub);
      return;
    }

    // ---- recent verdicts ----
    if (req.method === "GET" && req.url?.startsWith("/verdicts")) {
      const u = new URL(req.url, "http://x");
      // [stress fix #2] sanitize limit: NaN/negative/zero → default 50 (was returning an empty array on ?limit=abc)
      const rawLimit = Number(u.searchParams.get("limit") ?? 50);
      const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 50;
      const out = store.recent(limit, u.searchParams.get("account") ?? undefined);
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(out));
      return;
    }

    // ---- simulate only (paste-any-tx; no signing/submitting) ----
    if (req.method === "POST" && req.url === "/simulate") {
      const parsed = parseJson(await readRaw(req));
      if (!parsed.ok) return badRequest(res, "malformed JSON body");
      const b = parsed.value as SimulateRequest;
      const invalid = validateCallBody(b);
      if (invalid) return badRequest(res, invalid);
      const call: PendingCall = toCall(b);
      const decoded = decodeCall(call); // decode FIRST so the watch set covers the real approve spender
      const watch = defaultWatchSet(call.to, decoded.spender ? [decoded.spender] : []);
      const deltas = await simulate(b.account, call, watch);
      const v = await classify(b.account, call, decoded, deltas, b.intent ?? { statedGoal: "(none)", expectedTargets: [] });
      const saved = store.add(dto(b.account, call, v, null));
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(saved));
      return;
    }

    // ---- propose: simulate → classify → cosign | veto ----
    if (req.method === "POST" && req.url === "/propose") {
      const parsed = parseJson(await readRaw(req));
      if (!parsed.ok) return badRequest(res, "malformed JSON body");
      const b = parsed.value as ProposeRequest;
      const invalid = validateCallBody(b);
      if (invalid) return badRequest(res, invalid);
      const call: PendingCall = toCall(b);
      const decoded = decodeCall(call); // decode FIRST so the watch set covers the real approve spender
      const watch = defaultWatchSet(call.to, decoded.spender ? [decoded.spender] : []);
      const deltas = await simulate(b.account, call, watch);
      const v = await classify(b.account, call, decoded, deltas, b.intent);

      // [debug fix #5] serialize nonce-read → cosign/veto per account to avoid the TOCTOU race
      const result = await withAccountLock(b.account, async () => {
        const nonce = await readNonce(b.account);
        if (v.decision === "VETO") {
          const h = callHash(call, nonce);
          const blockedTxHash = await submitVeto(b.account, nonce, call.to, h, v.reasons.join("; "));
          const saved = store.add(dto(b.account, call, v, blockedTxHash));
          return { decision: "VETO" as const, blockedTxHash, verdict: saved };
        }
        const guardianSig = await cosign(b.account, call, nonce);
        const saved = store.add(dto(b.account, call, v, null));
        return { decision: "COSIGN" as const, guardianSig, nonce: nonce.toString(), verdict: saved };
      });

      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(result));
      return;
    }

    res.writeHead(404).end("not found");
  } catch (err) {
    res.writeHead(500, { "content-type": "application/json" }).end(JSON.stringify({ error: (err as Error).message }));
  }
});

server.listen(PORT, () => console.log(`Backstop keeper on :${PORT}`));
