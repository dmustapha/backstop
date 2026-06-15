// File: keeper/test/setup.ts
// Hermetic test env, applied at import time BEFORE clients.ts (which throws without GUARDIAN_KEY) and
// before the classifier's transitive imports resolve. Importing this module first guarantees the env is
// in place because ES import side effects run in import order. None of these touch the real network or
// sign anything on-chain — they only make the Tier-A floor unit tests deterministic and offline.
process.env.GUARDIAN_KEY ??= "0x0000000000000000000000000000000000000000000000000000000000000001"; // throwaway
process.env.MANTLE_RPC_URL = "http://127.0.0.1:1"; // unreachable; any stray Tier-B getBytecode fails closed
delete process.env.THREATINTEL_API_KEY; // force the offline known-drainer fallback (no live provider in tests)
process.env.STATIC_DRAINERS = ""; // nothing statically flagged: isolate the delta/recipient logic
