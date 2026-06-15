// File: scripts/onboard-fresh.ts
// Live fresh-agent onboarding proof (gap ON2). Proves Mode A end-to-end against the HOSTED guardian:
// a brand-new key, never seen before, is wrapped on-chain and immediately guarded — a drainer is
// vetoed (on-chain Blocked) and a legit call is co-signed (on-chain execute). Captures all tx hashes.
//
// ⚠ SPENDS REAL MNT and creates a NEW on-chain agent (next agentId). Run intentionally:
//     node --env-file=.env --import tsx scripts/onboard-fresh.ts
// Optional: FRESH_AGENT_KEY=0x... to reuse a key (idempotent — wrap() is per-(owner,guardian) salt).
import { createWalletClient, createPublicClient, http, parseEther, encodeFunctionData, formatEther, type Hex } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { mantleSepolia, RPC_URL, WMNT, AGNI_ROUTER, explorerTx, explorerAddr } from "../shared/addresses";
import { ERC20_ABI } from "../shared/abis";
import { wrap } from "../sdk/src/wrap";
import { scenarios } from "../agent/src/scenarios";

// Always the HOSTED guardian (this is the Mode-A proof). Dedicated override var so a local
// KEEPER_URL=localhost in .env cannot hijack the proof. Set ONBOARD_KEEPER_URL only to retarget.
const HOSTED_KEEPER = process.env.ONBOARD_KEEPER_URL ?? "https://backstop-keeper.onrender.com";
// Mantle Sepolia gasPrice ~50 gwei; createAccount deploys a contract (~1.5M gas) + the COSIGN does
// one execute. 0.3 MNT covers both with a wide buffer (under-funding surfaces as a misleading
// "execution reverted" during gas estimation, not a clean "insufficient funds").
const FUND_MNT = parseEther("0.3");

async function main() {
  const deployerKey = process.env.DEPLOYER_KEY as Hex;
  if (!deployerKey) throw new Error("DEPLOYER_KEY missing (needed to fund the fresh agent)");

  // 1. a brand-new key the system has never seen
  const freshKey = (process.env.FRESH_AGENT_KEY as Hex) ?? generatePrivateKey();
  const fresh = privateKeyToAccount(freshKey);
  console.log(`[onboard] fresh agent key      ${freshKey}`);
  console.log(`[onboard] fresh agent address  ${fresh.address}`);
  console.log(`[onboard] hosted guardian      ${HOSTED_KEEPER}`);

  const pub = createPublicClient({ chain: mantleSepolia, transport: http(RPC_URL) });
  const deployer = createWalletClient({ account: privateKeyToAccount(deployerKey), chain: mantleSepolia, transport: http(RPC_URL) });

  // 2. fund the fresh key for gas (createAccount + execute)
  const bal = await pub.getBalance({ address: fresh.address });
  if (bal < FUND_MNT) {
    const fundHash = await deployer.sendTransaction({ to: fresh.address, value: FUND_MNT });
    await pub.waitForTransactionReceipt({ hash: fundHash });
    console.log(`[onboard] funded ${formatEther(FUND_MNT)} MNT  ${explorerTx(fundHash)}`);
  } else {
    console.log(`[onboard] already funded (${formatEther(bal)} MNT)`);
  }

  // 3. wrap against the HOSTED keeper — deploys a guarded account + ERC-8004 identity
  const signer = await wrap(freshKey, {
    keeperUrl: HOSTED_KEEPER,
    name: "Backstop fresh-onboard proof agent",
    description: "A never-before-seen agent onboarded live against the hosted Backstop guardian.",
  });
  console.log(`[onboard] guarded account      ${signer.account}  ${explorerAddr(signer.account)}`);
  console.log(`[onboard] ERC-8004 agentId     ${signer.agentId}`);

  // 4. drainer → expect VETO with an on-chain Blocked event (the guardian pays this gas, not the agent)
  const evil = scenarios["malicious-approve"];
  const evilCall = evil.build(signer.account)[0];
  const vetoRes = await signer.propose(evilCall.to, evilCall.value, evilCall.data, evil.intent);
  if (vetoRes.decision !== "VETO") throw new Error(`[onboard] FATAL: drainer was ${vetoRes.decision}, expected VETO`);
  console.log(`[onboard] drainer  → VETO       ${vetoRes.txHash ? explorerTx(vetoRes.txHash) : "(no tx)"}`);

  // 5. legit bounded approve to the allowlisted Agni router → expect COSIGN (on-chain execute by the agent)
  const okIntent = { statedGoal: "approve the Agni router to spend 1 WMNT for a swap", expectedTargets: [WMNT, AGNI_ROUTER] };
  const okApprove = encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [AGNI_ROUTER, parseEther("1")] });
  const okRes = await signer.propose(WMNT, 0n, okApprove, okIntent);
  if (okRes.decision !== "COSIGN") throw new Error(`[onboard] FATAL: legit approve was ${okRes.decision}, expected COSIGN`);
  console.log(`[onboard] legit    → COSIGN     ${okRes.txHash ? explorerTx(okRes.txHash) : "(no tx)"}`);

  console.log("\n=== ONBOARD PROOF (copy into dashboard/app/proof/page.tsx) ===");
  console.log(JSON.stringify({
    freshAddress: fresh.address,
    account: signer.account,
    agentId: signer.agentId.toString(),
    vetoTx: vetoRes.txHash,
    cosignTx: okRes.txHash,
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
