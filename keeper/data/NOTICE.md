# Third-party data attribution

## known-drainers.json

Derived from the **ethereum-lists** project (MyEtherWallet) — `addresses-darklist.json`.

- Source: https://github.com/MyEtherWallet/ethereum-lists
- License: **MIT**
- Fetched: 2026-06-15
- Transform: addresses lowercased, comments collapsed/trimmed to ≤120 chars, restructured as an
  address→comment map for O(1) lookup. No addresses added or removed from the source set.

The MIT license permits redistribution with attribution. This NOTICE satisfies that requirement.
The demo drainer (`0x088bA48…`) is pinned separately via the `STATIC_DRAINERS` env var, not this file.
