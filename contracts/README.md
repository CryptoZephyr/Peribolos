# Peribolos Contracts

Rule-enforced USDC spending vaults for AI agents on Arc (Circle's L1, USDC-native gas).
Spec: [`../Peribolos_Product_Spec-3.md`](../Peribolos_Product_Spec-3.md) (v3.1) — §4 is the enforcement model these contracts implement.

## Layout

| File | Purpose |
|---|---|
| `src/PeribolosVault.sol` | One per domain. On-chain policy gate: allowlist, per-tx cap, daily (UTC-epoch) cap, action bitmap, agent expiry, pause. `pay()` never reverts on rule violations — it emits `PaymentBlocked(reason)` so attacks become permanent on-chain evidence. Registers itself in the ERC-8004 IdentityRegistry (holds its own identity NFT). |
| `src/PeribolosFactory.sol` | Deploys vaults. `createDomain` is `payable`: one transaction deploys + registers + forwards the agent's gas sliver + funds the vault (native USDC and ERC-20 USDC are the same asset on Arc). |
| `script/Deploy.s.sol` | Factory deployment script (keystore-based; see file header). |
| `test/` | 53 vault unit tests · 9 factory tests · 3 fuzz suites (1024 runs) · 3 invariants (128 runs × depth 64) · 1 live-fork test. |

## Commands

```bash
export FOUNDRY_DISABLE_NIGHTLY_WARNING=1
forge build                                   # compile (solc 0.8.30, evm prague)
forge test                                    # full suite (fork test needs network)
forge test --match-path "test/fork/*" -vv     # live-state fork test only
```

## Deploy-readiness checklist

Verified ✅ (2026-07-11, all against live Arc testnet where marked):

- ✅ Compiles clean — solc 0.8.30, `evm_version = prague` (≤ Arc's Osaka baseline; no PREVRANDAO / SELFDESTRUCT / blob dependencies)
- ✅ 68 local tests green: every `BlockReason` asserted by exact event; epoch-rollover fuzz; transfer-failure rollback (both revert and returns-false modes); invariant: outflows only to allowlisted recipients / treasury / owner
- ✅ **Live-fork test green**: the real ERC-8004 IdentityRegistry (`0x8004A818…BD9e`) accepts `register(string)` from a vault (contract caller) and mints the identity NFT to it
- ✅ Live probes: chain ID `5042002`; USDC at `0x3600…0000` answers `decimals()=6`, `symbol()="USDC"`, has real bytecode; registry `supportsInterface(ERC-721)=true`
- ✅ Arc-specific hazards designed in: try/catch around `pay()` transfers (runtime blocklist), `onERC721Received` hook, `receive()` for native-USDC funding, 6-vs-18 decimal separation (all vault amounts are 6-dec ERC-20 units)

## DEPLOYED — 2026-07-18 (v3.1, `feeBps`) ✅

| What | Address / hash |
|---|---|
| **PeribolosFactory** | [`0xda3751cd08435D8b5137DD11A9a7797c214cfC4a`](https://testnet.arcscan.app/address/0xda3751cd08435d8b5137dd11a9a7797c214cfc4a) |
| Smoke vault | [`0x62D5487d6523fc4D34692e1DbF8EBC01F39BbC7B`](https://testnet.arcscan.app/address/0x62d5487d6523fc4d34692e1dbf8ebc01f39bbc7b) |
| Deployer | `0xaE382c0cD4d3E1f704508D3BABe0F55e2A319652` (keystore in `keystores/`, gitignored) |
| Smoke agent EOA | `0x70f7C02f0CC83541325cf990b2B7A2cf7cc08748` |
| `feeBps` on smoke vault | **0** (testnet default) |

### Prior factory (2026-07-11, pre-feeBps)

| What | Address |
|---|---|
| Factory | [`0xe1d75f5fCF28F6875Eb701dB7b37D31c54aB67d8`](https://testnet.arcscan.app/address/0xe1d75f5fcf28f6875eb701db7b37d31c54ab67d8) |
| Old smoke vault | [`0x8b1EB4470234b392970A0E67533d57D3E4101a58`](https://testnet.arcscan.app/address/0x8b1eb4470234b392970a0e67533d57d3e4101a58) |

Live smoke test — all passed on-chain:

- ✅ One-tx domain creation (`createDomain`, 3.5 USDC value → 3.0 vault + 0.5 agent gas + ERC-8004 registration), tx `0x7630130e…f56246`
- ✅ Allowlisted `pay` of 1 USDC → `PaymentExecuted`, epoch accounting correct, tx `0xe8221cb6…294c39`
- ✅ Drain attempt to non-allowlisted `0xdEaD` → **tx succeeded, zero funds moved, `PaymentBlocked(RECIPIENT_NOT_ALLOWLISTED)` permanently on-chain**, tx `0xf7491952…7f7b23`
- ✅ Permissionless `sweepIdle` → excess to treasury, vault left at exactly its 1 USDC float
- ✅ Source verification submitted to Arcscan (Blockscout), GUID `e1d75f5f…c078` — confirm the "Verified" badge appears on the address page

Every new domain is a `createDomain` call on the current factory. Frontend/SDK config: `FACTORY=0xda3751cd08435D8b5137DD11A9a7797c214cfC4a`, chain `5042002`.

## Design decisions (intentional, do not "fix")

- `pay()` is non-reverting on rule violations — blocked attempts are the product's evidence feed.
- `sweepIdle()`/`withdraw()` revert loudly (no try/catch) — owner/keeper paths must surface failures.
- `currentEpoch` advances even when a transfer fails; only `epochSpent` rolls back (accurate state either way).
- ERC-8004 registration is best-effort (`try/catch`) — a registry outage must never brick domain creation.
- Fixed UTC-day epochs (`block.timestamp / 1 days`), not a rolling window — simple, cheap, explainable.
- No protocol fee code in v1 — fee activation is a future factory version (spec P2), keeping attack surface minimal.
