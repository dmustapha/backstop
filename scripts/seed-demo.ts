// File: scripts/seed-demo.ts
import { createWalletClient, createPublicClient, http, parseEther, encodeFunctionData, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mantleSepolia, RPC_URL, WMNT, AGNI_ROUTER } from "../shared/addresses";
import { ERC20_ABI } from "../shared/abis";
import { wrap } from "../sdk/src/wrap";
import { scenarios } from "../agent/src/scenarios";

/**
 * Idempotent demo seed — produces REAL on-chain state:
 *  1. wrap() the demo agent (deploys guarded account + ERC-8004 identity)
 *  2. fund the account with WMNT (MNT must be pre-funded from faucet)
 *  3. run prior scenarios to create ≥3 CoSigned + ≥3 Blocked real verdicts
 */
async function main() {
  const agentKey = process.env.DEMO_AGENT_KEY as Hex;
  if (!agentKey) throw new Error("DEMO_AGENT_KEY missing");
  const owner = privateKeyToAccount(agentKey);
  const pub = createPublicClient({ chain: mantleSepolia, transport: http(RPC_URL) });
  const wallet = createWalletClient({ account: owner, chain: mantleSepolia, transport: http(RPC_URL) });

  const signer = await wrap(agentKey, { name: "Backstop demo agent" });
  console.log(`[seed] guarded account ${signer.account} agentId ${signer.agentId}`);

  // wrap MNT → WMNT into the account (account is the holder; owner sends value, account receives WMNT)
  // For demo simplicity the agent deposits to itself then transfers WMNT to the account via a co-signed call.
  const wmntBal = (await pub.readContract({ address: WMNT, abi: ERC20_ABI, functionName: "balanceOf", args: [signer.account] })) as bigint;
  if (wmntBal < parseEther("2")) {
    // owner wraps and the account receives via co-signed transfer (kept real + on-chain)
    const depositData = encodeFunctionData({ abi: ERC20_ABI, functionName: "deposit" });
    const h = await wallet.sendTransaction({ to: WMNT, value: parseEther("2"), data: depositData });
    await pub.waitForTransactionReceipt({ hash: h });
    const xferData = encodeFunctionData({ abi: ERC20_ABI, functionName: "transfer", args: [signer.account, parseEther("2")] });
    const h2 = await wallet.sendTransaction({ to: WMNT, data: xferData });
    await pub.waitForTransactionReceipt({ hash: h2 });
    console.log(`[seed] funded account with 2 WMNT`);
  }

  // Create prior verdict history — all REAL on-chain, WMNT-light (the account's 2 WMNT are kept
  // intact for the live `npm run agent legit-swap` demo, which does the actual swap on camera):
  //   3x malicious-approve(EVIL, MAX)            → Blocked  (guardianVeto; gas only, no funds move)
  //   3x bounded approve(AgniRouter, 1 WMNT)     → CoSigned (allowlisted spender; sets allowance, no WMNT spent)
  let cosigned = 0, blocked = 0;
  const evil = scenarios["malicious-approve"];
  for (let i = 0; i < 3; i++) {
    const c = evil.build(signer.account)[0];
    const r = await signer.propose(c.to, c.value, c.data, evil.intent);
    if (r.decision !== "VETO") throw new Error(`[seed] FATAL: malicious-approve was ${r.decision}, expected VETO — Tier-A floor misconfigured`);
    blocked++;
    console.log(`[seed] malicious-approve → VETO ${r.txHash ?? ""}`);
  }
  const okIntent = { statedGoal: "approve the Agni router to spend 1 WMNT for a swap", expectedTargets: [WMNT, AGNI_ROUTER] };
  const okApprove = encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [AGNI_ROUTER, parseEther("1")] });
  for (let i = 0; i < 3; i++) {
    const r = await signer.propose(WMNT, 0n, okApprove, okIntent);
    if (r.decision !== "COSIGN") throw new Error(`[seed] FATAL: bounded router approve was ${r.decision}, expected COSIGN — classifier/allowlist misconfigured`);
    cosigned++;
    console.log(`[seed] approve(AgniRouter,1) → COSIGN ${r.txHash ?? ""}`);
  }
  console.log(`[seed] done — ${cosigned} CoSigned + ${blocked} Blocked real on-chain verdicts seeded`);
}

main().catch((e) => { console.error(e); process.exit(1); });
