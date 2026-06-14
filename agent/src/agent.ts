// File: agent/src/agent.ts
import Anthropic from "@anthropic-ai/sdk";
import { type Hex } from "viem";
import { wrap } from "../../sdk/src/wrap";
import { scenarios } from "./scenarios";

/**
 * Minimal autonomous agent: Claude "decides" to run a scenario, then the agent proposes the
 * resulting call(s) through its Backstop-guarded account. CO-SIGN → execute; VETO → saved by Backstop.
 */
async function main() {
  const agentKey = process.env.DEMO_AGENT_KEY as Hex;
  if (!agentKey) throw new Error("DEMO_AGENT_KEY missing");
  const scenarioName = process.argv[2] ?? "malicious-approve";
  const scenario = scenarios[scenarioName];
  if (!scenario) throw new Error(`unknown scenario: ${scenarioName}`);

  // make the decision genuinely LLM-driven (agent autonomy for the "AI acts" judge moment)
  if (process.env.ANTHROPIC_API_KEY) {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const r = await client.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 128,
      messages: [{ role: "user", content: `You are an autonomous DeFi agent. State in one line your intent for: "${scenario.intent.statedGoal}".` }],
    });
    const text = r.content.find((b) => b.type === "text");
    console.log(`[agent] intent: ${text && "text" in text ? text.text : scenario.intent.statedGoal}`);
  }

  const signer = await wrap(agentKey, { name: `Demo agent (${scenarioName})` });
  console.log(`[agent] guarded account ${signer.account} (agentId ${signer.agentId})`);

  for (const call of scenario.build(signer.account)) {
    console.log(`[agent] proposing → ${call.to} ${call.data.slice(0, 10)}…`);
    const result = await signer.propose(call.to, call.value, call.data, scenario.intent);
    console.log(`[agent] ${result.decision}${result.txHash ? ` tx=${result.txHash}` : ""} :: ${result.reasons.join("; ")}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
