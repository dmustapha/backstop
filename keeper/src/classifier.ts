// File: keeper/src/classifier.ts
import { type Address, type Hex } from "viem";
import { pub } from "./clients";
import { labelAddress } from "./nansen";
import { judge } from "./llm";
import { ALLOWLIST } from "../../shared/addresses";
import { DANGEROUS_SELECTORS } from "../../shared/abis";
import type { AgentIntent, DecodedCall, LlmJudgment, PendingCall, SimResult, Verdict } from "../../shared/types";

const DUST = 0n; // any strictly-negative self delta counts as an outflow
const UNLIMITED = 2n ** 255n; // "unlimited-ish" approval threshold

function isAllowlisted(a: Address): boolean {
  return ALLOWLIST.map((x) => x.toLowerCase()).includes(a.toLowerCase());
}

function hasOutflow(d: SimResult): boolean {
  return d.nativeSelfDelta < DUST || d.tokenSelfDeltas.some((x) => x < DUST);
}

/** The single classify entry point. Deterministic floor is authoritative; LLM only adds scrutiny.
 *  `decoded` is computed once by the keeper (server.ts) and used to build the sim watch set, so it
 *  is passed in rather than re-decoded here. `account` (self) is always a safe value sink. */
export async function classify(
  account: Address,
  call: PendingCall,
  decoded: DecodedCall,
  deltas: SimResult,
  intent: AgentIntent,
): Promise<Verdict> {
  const self = account.toLowerCase();
  let grayZone = false; // a bounded approval to a non-allowlisted spender must reach Tier-B (never fast-cosign)

  // [debug fix #2] If the simulation reverted, the deltas are unreliable (all-zero) and the
  // deterministic floor is blind to any outflow — never let the floor fast-cosign a call we could
  // not actually simulate. Force Tier-B scrutiny. (A1–A4 below still run on the decoded calldata.)
  if (!deltas.execOk) grayZone = true;

  // ---------- TIER A — deterministic floor (authoritative) ----------
  // A1 approval abuse
  if (decoded.spender) {
    const big = (decoded.approvalAmount ?? 0n) >= UNLIMITED
      || deltas.allowanceDeltas.some((x) => x >= UNLIMITED);
    const spenderSafe = isAllowlisted(decoded.spender);
    const lbl = await labelAddress(decoded.spender);
    if (!spenderSafe && (big || lbl.flagged)) {
      return veto("A", deltas, decoded, [
        `Tier-A #1 approval abuse: ${big ? "unlimited/large" : "non-allowlisted"} approval to ${decoded.spender}${lbl.flagged ? ` (flagged: ${lbl.labels.join(",")})` : ""}`,
      ]);
    }
    // bounded, unflagged approval to a non-allowlisted spender: not an auto-veto, but the LLM MUST
    // judge it (this is the #6 intent↔spender-mismatch gray zone) — block the fast-cosign path.
    if (!spenderSafe) grayZone = true;
  }

  // A2 immediate drain — outflow to a non-allowlisted recipient (self is never a drain target)
  if (hasOutflow(deltas)) {
    const recips = decoded.recipients;
    const unknownRecipient = recips.length === 0; // unknown selector w/ outflow → conservative
    const bad = recips.find((r) => !isAllowlisted(r) && r.toLowerCase() !== self);
    if (unknownRecipient || bad) {
      const lbl = bad ? await labelAddress(bad) : { flagged: false, labels: [] as string[], source: "none" as const };
      return veto("A", deltas, decoded, [
        `Tier-A #2 immediate drain: net outflow to ${unknownRecipient ? "an unknown recipient (unrecognized calldata)" : bad}${lbl.flagged ? ` (flagged: ${lbl.labels.join(",")})` : ""}`,
      ]);
    }
    // [debug fix #1] A recognized swap returns value to self: its decoded recipients include `self`
    // (exactInputSingle decodes recipients=[router, recipient] with recipient=self → USDC comes back).
    // A pure outflow with NO value returning to the account (e.g. a raw ERC20 transfer of the agent's
    // funds to a DEX pool/router) is NOT a swap — it is an unrecoverable loss — so the deterministic
    // floor must NOT fast-cosign it; force Tier-B scrutiny. (Allowlisted recipients are not auto-safe
    // as value SINKS; the allowlist governs what the agent may interact with, not who may keep its funds.)
    const valueReturnsToSelf = recips.some((r) => r.toLowerCase() === self);
    if (!valueReturnsToSelf) grayZone = true;
  }

  // A3 privilege escalation
  const escFn = DANGEROUS_SELECTORS[decoded.selector];
  if (escFn && !isAllowlisted(call.to)) {
    return veto("A", deltas, decoded, [`Tier-A #3 privilege escalation: ${escFn} on non-allowlisted ${call.to}`]);
  }

  // A4 known-bad target
  const targetLabel = await labelAddress(call.to);
  if (targetLabel.flagged) {
    return veto("A", deltas, decoded, [`Tier-A #4 known-bad target: ${call.to} (${targetLabel.labels.join(",")})`]);
  }

  // ---------- floor is clean ----------
  const targetAllowlisted = isAllowlisted(call.to);
  const intentClear = !grayZone && targetAllowlisted && intentTargetsMatch(account, intent, call.to, decoded);
  if (intentClear) {
    return cosign("FLOOR", deltas, decoded, [
      `Deterministic floor clean: allowlisted target ${call.to}, effect matches stated intent`,
    ]);
  }

  // ---------- TIER B — LLM judgment (gray zone: unknown target/spender or intent ambiguity) ----------
  const llm = await llmJudge(call, deltas, decoded, intent);
  if (llm.unavailable) {
    // fail toward scrutiny: only fast-cosign when the target is allowlisted AND there is no gray zone
    if (targetAllowlisted && !grayZone) {
      return cosign("FLOOR", deltas, decoded, ["LLM unavailable; allowlisted target, no gray zone; deterministic floor clean"], llm);
    }
    return veto("FLOOR", deltas, decoded, ["LLM unavailable; gray zone (unknown target/spender); failing toward scrutiny (veto)"], llm);
  }
  if (llm.decision === "VETO") {
    return veto("B", deltas, decoded, [`Tier-B LLM: ${llm.reason}`], llm);
  }
  return cosign("B", deltas, decoded, [`Tier-B LLM cleared: ${llm.reason}`], llm);
}

function intentTargetsMatch(account: Address, intent: AgentIntent, to: Address, decoded: DecodedCall): boolean {
  if (intent.expectedTargets.length === 0) return false;
  const expected = intent.expectedTargets.map((a) => a.toLowerCase());
  if (!expected.includes(to.toLowerCase())) return false;
  const self = account.toLowerCase();
  // recipients (if any) must be self, an expected target, or allowlisted
  return decoded.recipients.every((r) => {
    const rl = r.toLowerCase();
    return rl === self || expected.includes(rl) || isAllowlisted(r);
  });
}

// ---- Tier-B: pluggable LLM tool-use with self-correction (see § Agent Architecture #12) ----
// The actual model call is delegated to keeper/src/llm.ts (AltLLM primary → Anthropic fallback);
// this function owns context-gathering, the verdict tool schema, the prompts, and the retry loop.
const VERDICT_TOOL_NAME = "report_verdict";
const VERDICT_TOOL_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    decision: { type: "string", enum: ["COSIGN", "VETO"] },
    confidence: { type: "number", description: "0..1" },
    reason: { type: "string" },
  },
  required: ["decision", "confidence", "reason"],
};

async function llmJudge(
  call: PendingCall, deltas: SimResult, decoded: DecodedCall, intent: AgentIntent,
): Promise<LlmJudgment> {
  // gather context: target bytecode (unknown-contract judgment #5)
  let code: Hex = "0x";
  try { code = (await pub.getCode({ address: call.to })) ?? "0x"; } catch { /* ignore */ }
  // [debug fix #3] Feed the LLM the ACTUAL runtime opcodes (not just a byte count) so #5 is a real
  // drainer-pattern judgment (delegatecall 0xf4 / selfdestruct 0xff / disguised transfer), not mere
  // opacity caution. Truncate to keep the prompt bounded.
  const codeSummary = code === "0x"
    ? "EOA / no code"
    : `${(code.length - 2) / 2} bytes of runtime bytecode; opcodes(hex)=${code.length > 1026 ? code.slice(0, 1026) + "…(truncated)" : code}`;

  const sys =
    "You are Backstop, an on-chain guardian for autonomous AI agents on Mantle. You judge whether a " +
    "pending transaction should be CO-SIGNED (safe) or VETOED (would drain/harm the agent). The deterministic " +
    "engine has already cleared immediate drains and approval abuse — you ONLY judge two gray-zone risks: " +
    "(#5) unknown-contract drainer patterns (hidden transfer, disguised approval, delegatecall-to-arbitrary, " +
    "selfdestruct), and (#6) intent↔calldata mismatch (the agent's STATED goal disagrees with the SIMULATED " +
    "effect — the prompt-injection signature). When unsure, prefer VETO. Always call report_verdict.";

  const userMsg =
    `STATED INTENT: ${JSON.stringify(intent)}\n` +
    `CALL: to=${call.to} value=${call.value} selector=${decoded.selector} fn=${decoded.functionName ?? "UNKNOWN"}\n` +
    `APPROVAL (if any): spender=${decoded.spender ?? "n/a"} amount=${decoded.approvalAmount?.toString() ?? "n/a"}\n` +
    `TARGET CODE: ${codeSummary}\n` +
    `SIMULATED EFFECT (signed deltas): native=${deltas.nativeSelfDelta} tokens=${JSON.stringify(deltas.tokenSelfDeltas.map(String))} allowances=${JSON.stringify(deltas.allowanceDeltas.map(String))} execOk=${deltas.execOk}\n` +
    `RECIPIENTS DECODED: ${JSON.stringify(decoded.recipients)}\n` +
    `Judge #5 and #6. For #6, compare the STATED INTENT's expectedTargets against the actual call target / approval spender / recipients — if the agent meant to touch X but the calldata touches Y, that is a mismatch → VETO. Is the target a drainer pattern?`;

  // self-correction loop: retry up to 3x if confidence < 0.7 (escalate context each retry)
  const MAX = 3;
  let lastProvider: "altllm" | "anthropic" = "altllm";
  for (let attempt = 1; attempt <= MAX; attempt++) {
    const out = await judge({
      system: sys,
      userMsg: attempt === 1 ? userMsg : `${userMsg}\n(Reconsider carefully; previous confidence was low. Default to VETO if still unsure.)`,
      toolName: VERDICT_TOOL_NAME,
      toolSchema: VERDICT_TOOL_SCHEMA,
    });
    lastProvider = out.provider;
    if (out.unavailable) {
      // both providers failed → propagate the unavailable signal (classifier falls to the floor)
      return { decision: "VETO", confidence: 0, reason: out.reason, unavailable: true, provider: out.provider };
    }
    if (out.confidence >= 0.7 || attempt === MAX) {
      return { decision: out.decision, confidence: out.confidence, reason: out.reason, provider: out.provider };
    }
  }
  return { decision: "VETO", confidence: 0, reason: "LLM low-confidence after retries", unavailable: false, provider: lastProvider };
}

// ---- verdict constructors ----
function veto(tier: Verdict["tier"], deltas: SimResult, decoded: DecodedCall, reasons: string[], llm?: LlmJudgment): Verdict {
  return { decision: "VETO", tier, reasons, deltas, decoded, llm: llm ?? null, confidence: llm?.confidence ?? 1 };
}
function cosign(tier: Verdict["tier"], deltas: SimResult, decoded: DecodedCall, reasons: string[], llm?: LlmJudgment): Verdict {
  return { decision: "COSIGN", tier, reasons, deltas, decoded, llm: llm ?? null, confidence: llm?.confidence ?? 1 };
}
