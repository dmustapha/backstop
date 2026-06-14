// File: keeper/src/llm.ts
// Pluggable Tier-B provider shim — [CRITIQUE E-6].
// PRIMARY = AltLLM (OpenAI-compatible, raw fetch). FALLBACK = Anthropic (@anthropic-ai/sdk).
// Both return ONE model judgment with confidence normalized to a single 0..1 scale so the
// classifier's `>= 0.7` threshold is correct regardless of which provider answered.
import Anthropic from "@anthropic-ai/sdk";

export interface JudgeRequest {
  system: string;
  userMsg: string;
  toolName: string;
  toolSchema: Record<string, unknown>; // JSON-schema object for the tool parameters/input
}

export interface JudgeResult {
  decision: "COSIGN" | "VETO";
  confidence: number; // ALWAYS normalized 0..1
  reason: string;
  provider: "altllm" | "anthropic";
  unavailable?: boolean; // true => both providers failed; caller falls to the deterministic floor
}

const TOOL_DESCRIPTION = "Report whether this agent transaction should be co-signed or vetoed.";

/** Normalize a confidence value to the 0..1 scale, EXPLICITLY per provider (debug fix #4).
 *  AltLLM returns 0..1; Anthropic returns 0..100 in this project. We key off the known provider
 *  instead of inferring scale from the value (which misreads e.g. a 0..100 "0.6" as 60%). The result
 *  is clamped to [0,1]. Note: confidence only gates the self-correction RETRY loop — it never flips
 *  the decision — so a normalization error can at worst change retry count, never make a verdict unsafe. */
function normalizeConfidence(raw: unknown, provider: "altllm" | "anthropic"): number {
  let n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 0;
  if (provider === "anthropic" && n > 1) n = n / 100; // Anthropic 0..100 → 0..1
  // AltLLM is 0..1; if a provider ever returns >1 unexpectedly, the clamp below bounds it safely.
  return Math.max(0, Math.min(1, n));
}

/** Coerce an arbitrary parsed tool payload into the {decision, confidence, reason} contract. */
function coerce(out: unknown, provider: "altllm" | "anthropic"): { decision: "COSIGN" | "VETO"; confidence: number; reason: string } | null {
  if (!out || typeof out !== "object") return null;
  const o = out as Record<string, unknown>;
  const decision = o.decision;
  if (decision !== "COSIGN" && decision !== "VETO") return null;
  const reason = typeof o.reason === "string" ? o.reason : "";
  return { decision, confidence: normalizeConfidence(o.confidence, provider), reason };
}

/** One judgment from the configured provider chain: AltLLM primary → Anthropic fallback. */
export async function judge(req: JudgeRequest): Promise<JudgeResult> {
  // Test seam (DEV-003): a deterministic, offline-forced judgment for unit tests ONLY. This is an
  // explicit dependency-injection hook, NOT a production fallback — it is inert unless the env var is
  // set, so every real keeper run hits the live AltLLM/Anthropic chain below.
  const forced = process.env.BACKSTOP_TEST_LLM;
  if (forced === "COSIGN" || forced === "VETO" || forced === "UNAVAILABLE") {
    if (forced === "UNAVAILABLE") {
      return { decision: "VETO", confidence: 0, reason: "LLM unavailable: forced (test seam)", provider: "altllm", unavailable: true };
    }
    return { decision: forced, confidence: 1, reason: `forced ${forced} (test seam)`, provider: "altllm" };
  }

  let lastTried: "altllm" | "anthropic" = "altllm";
  let detail = "";

  // ---------- PRIMARY: AltLLM (OpenAI-compatible, raw fetch) ----------
  const altKey = process.env.LLM_API_KEY;
  const altBase = process.env.LLM_BASE_URL;
  const altModel = process.env.LLM_MODEL;
  if (altKey && altBase && altModel) {
    try {
      const res = await fetch(`${altBase}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${altKey}`,
        },
        body: JSON.stringify({
          model: altModel,
          max_tokens: 512,
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.userMsg },
          ],
          tools: [{
            type: "function",
            function: { name: req.toolName, description: TOOL_DESCRIPTION, parameters: req.toolSchema },
          }],
          // PROVEN QUIRK (a): AltLLM wants tool_choice = {"type":"function","name":NAME}
          // (top-level name, NOT nested under `function` as in OpenAI v2).
          tool_choice: { type: "function", name: req.toolName },
        }),
      });
      if (!res.ok) {
        detail = `AltLLM ${res.status} ${(await res.text()).slice(0, 200)}`;
      } else {
        const json = (await res.json()) as {
          choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
        };
        const argStr = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        if (argStr) {
          const parsed = coerce(JSON.parse(argStr), "altllm");
          if (parsed) {
            return { ...parsed, provider: "altllm" }; // AltLLM confidence already 0..1
          }
          detail = "AltLLM tool_call arguments did not match {decision,confidence,reason}";
        } else {
          detail = "AltLLM returned no tool_call";
        }
      }
    } catch (err) {
      detail = `AltLLM error: ${(err as Error).message}`;
    }
  } else {
    detail = "AltLLM not configured (LLM_API_KEY/LLM_BASE_URL/LLM_MODEL missing)";
  }

  // ---------- FALLBACK: Anthropic (@anthropic-ai/sdk, validated tool-use shape) ----------
  lastTried = "anthropic";
  const anthKey = process.env.ANTHROPIC_API_KEY;
  if (anthKey) {
    try {
      const client = new Anthropic({ apiKey: anthKey });
      const resp = await client.messages.create({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
        max_tokens: 512,
        system: req.system,
        tools: [{
          name: req.toolName,
          description: TOOL_DESCRIPTION,
          input_schema: req.toolSchema as Anthropic.Tool.InputSchema,
        }],
        tool_choice: { type: "tool", name: req.toolName },
        messages: [{ role: "user", content: req.userMsg }],
      });
      const block = resp.content.find((b) => b.type === "tool_use") as Anthropic.ToolUseBlock | undefined;
      if (block) {
        const parsed = coerce(block.input, "anthropic"); // Anthropic 0..100 → normalized to 0..1
        if (parsed) return { ...parsed, provider: "anthropic" };
        detail = "Anthropic tool_use did not match {decision,confidence,reason}";
      } else {
        detail = "Anthropic returned no tool_use block";
      }
    } catch (err) {
      detail = `Anthropic error: ${(err as Error).message}`;
    }
  } else if (!detail.startsWith("Anthropic")) {
    detail = `${detail}; Anthropic fallback unavailable (ANTHROPIC_API_KEY missing)`;
  }

  // ---------- both providers failed ----------
  return { decision: "VETO", confidence: 0, reason: `LLM unavailable: ${detail}`, provider: lastTried, unavailable: true };
}
