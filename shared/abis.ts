// File: shared/abis.ts
import { parseAbi } from "viem";

export const ACCOUNT_ABI = parseAbi([
  "function execute(address to, uint256 value, bytes data, bytes guardianSig) returns (bytes)",
  "function executeAfterTimeout(address to, uint256 value, bytes data) returns (bytes)",
  "function guardianVeto(uint256 vetoNonce, address to, bytes32 callHash, string reason)",
  "function nonce() view returns (uint256)",
  "function owner() view returns (address)",
  "function guardian() view returns (address)",
  "function recoveryDelayBlocks() view returns (uint256)",
  "event CoSigned(uint256 indexed nonce, address indexed to, uint256 value, bytes data)",
  "event Blocked(uint256 indexed nonce, address indexed to, bytes32 callHash, string reason)",
  "event RecoveryExecuted(uint256 indexed nonce, address indexed to, uint256 value)",
]);

export const FACTORY_ABI = parseAbi([
  "function createAccount(address owner, address guardian, uint256 recoveryDelayBlocks, string agentURI) returns (address account, uint256 agentId)",
  "function computeAddress(address owner, address guardian, uint256 recoveryDelayBlocks) view returns (address)",
  "event AccountCreated(address indexed account, address indexed owner, address indexed guardian, uint256 agentId, string agentURI)",
]);

// SimResult tuple matches BackstopSimulator.SimResult exactly (order-sensitive).
export const SIMULATOR_ABI = parseAbi([
  "function simulate(address to, uint256 value, bytes data, address[] watchedTokens, address[] allowanceTokens, address[] allowanceSpenders) returns ((int256 nativeSelfDelta, int256[] tokenSelfDeltas, int256[] allowanceDeltas, bool execOk, bytes returnData))",
]);

export const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function increaseAllowance(address spender, uint256 added) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function deposit() payable", // WMNT wrap
]);

// Agni classic V3 SwapRouter (selector 0x414bf389 — WITH deadline, 8-field struct)
export const AGNI_ROUTER_ABI = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
]);

export const AGNI_QUOTER_ABI = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

// privilege-escalation selectors (Tier-A #3 watchlist)
export const DANGEROUS_SELECTORS: Record<string, string> = {
  "0xf2fde38b": "transferOwnership(address)",
  "0x3659cfe6": "upgradeTo(address)",
  "0x4f1ef286": "upgradeToAndCall(address,bytes)",
  "0xa22cb465": "setApprovalForAll(address,bool)",
};
