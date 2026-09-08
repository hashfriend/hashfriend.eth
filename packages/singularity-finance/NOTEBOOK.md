# Singularity Finance notebook

Dated observations for the [DynaVault post](../web/src/pages/singularity-finance-exploit.md). Commands and interpretation rules live in the [README](README.md). Append findings with their block or retrieval date, evidence and unresolved checks. A dated observation is not a claim about current state.

## Base address references

The admin account, governance and fee Safes, current oracle addresses and role-hash encodings are defined in [src/config.ts](src/config.ts). The [8 September snapshot](evidence/2026-09-08-viem.json) records full vault, manager and management-account addresses with their observed roles.

- Management account `0x4dd226D874bdA38a2FFd55f39acE3829b0217CF0` submits `swapAndReport()` calls.
- Drained vault `dynBaseUSDCv3`: `0x67b93f6676bd1911c5fae7ffa90fff5f35e14dcd`; manager `0x478675aa4121c07825167bbb25a44aadd22bef7f`.
- Replacement vault `dynBaseUSDCv4`: `0x4C1fa73Ebc7Aa7C88006D51414fC5387dE3bfE26`; manager `0x077fb8b4…d4b9c6`; zapper `0x21527E64…5D4AB`.
- Abandoned UniswapV3Oracle: `0x73b8c192bfc323c3ea224c88219d55dfc319e89f`, with 46 fee-42 routes documented in the post.
- The replacement stack deployed on 18 July included the Uniswap and USDC reference oracles listed in the configuration, ERC4626Oracle `0x81e4a1c0…85ba5b` and ChainlinkOracle `0x7129e96f…668494`.

Abbreviated addresses above are retained from the earlier post memory for identification only. Resolve full addresses from evidence before making calls.

## 31 August 2026 onchain update

Migrated from the post memory. Transaction links are retained in the [post timeline](../web/src/pages/singularity-finance-exploit.md#timeline); a complete raw August snapshot is not included in this package.

- On 15 August, governance moved to a Safe initially configured with two owners and a threshold of one. The fee Safe had three owners and a threshold of two.
- On 18 August, `DEFAULT_ADMIN_ROLE` moved from the admin account to the governance Safe on OracleRegistry `0x184b2217…0be877` and ReferenceAssetOracle `0x6e03c0b5…bfc0f1`; `ORACLE_ADMIN` on the reference oracle moved too. The replacement UniswapV3Oracle `0x566bb935…c581fb` retained both roles with the admin account.
- On 19 August, the admin called `setPermissionDisabled(true)` on BNB Chain vaults dynBnbUSDC `0xa42c06e4…9200b7` and dynBnbBTCB `0xb6d476a6…38e0f5`. dynBnbUSDT, dynBnbBNB and every Ethereum and Arbitrum vault were still permissioned at this snapshot.
- On 24 August, the governance Safe added owner `0xB10E5A27…19a609E` and raised its threshold to two on Base and BNB Chain. Both instances had the same three owners and a 2-of-3 threshold. Guardian remained with the original admin account.
- Production inventory was 18 vaults: nine Base, three Ethereum, two Arbitrum and four BNB Chain. The Optimism and Polygon registries were empty.
- All 18 production managers returned only zero addresses from `getTokenStrategies()` and zero token debt. The management account continued to call `swapAndReport()`.
- dynBaseUSDCv3 reported 101.84 USDC against 427,285 shares; dynBaseUSDCv4 reported 1,166.27 USDC. No vault-side recapitalization was visible. This does not rule out undisclosed direct payments from an unknown address.

## 8 September 2026 onchain update

Evidence: [original reads](evidence/2026-09-08-original.jsonl), [viem snapshot](evidence/2026-09-08-viem.json) and [gold-vault opening receipt](evidence/2026-09-05-gold-opening.json). These are separate reads taken that day; use each file's own block identity.

- The original snapshot pinned Ethereum 25,932,311; Optimism 156,633,835; Arbitrum 503,005,461; BNB Chain 120,677,306; Polygon 93,440,949; Base 51,038,554. It used `sfi-vault-sdk` 0.1.5 registry addresses and ABIs. All six registry reads succeeded. The later viem run also completed all six chains.
- Production inventory was 19: nine Base, three Ethereum, two Arbitrum and five BNB Chain vaults. Optimism and Polygon remained empty. All 19 had no configured strategies and zero token debt.
- New gold vault `dynBnbGold`, `0x2AbE7468F45a16e83fF6A3783180e9c532Bad197`, accepted the token named Tether Gold, `XAUt`, with six decimals at `0x21cAef8A43163Eea865baeE23b9C2E327696A3bf`. The admin disabled permissions on 5 September at 23:45:46 UTC in successful transaction `0x996c4ff71d08579d5203c2ecaaebff7dd54b0b6724ce0d08ebb2f759b8827e93`. Its manager `0x5E9359db317e1918B7FB4A4dc5083c156cC4d82D` retained governance and guardian with the admin account.
- `dynBnbUSDT`, `0x7eAa42F5138CA7d8c710C4238E590FA2d5623220`, returned `permissionDisabled=true`, unlike the August snapshot. Governance and guardian remained with the admin account. At BNB block 120,677,594, both USDT and Gold returned positive `maxDeposit()` for an address without `PERMITTED_USER`.
- Base and BNB governance Safes remained 2-of-3, with nonces three and one respectively. Base oracle roles were unchanged: registry and reference-oracle admin with the Safe, Uniswap oracle admin with the original account. All production guardians remained that account.
- Unresolved: the exact BNB USDT permission-opening transaction was not located. The state change is established between snapshots; its exact date is not.

## 8 September 2026 documentation review

The official docs do mention DynaVaults. [Architecture](https://docs.singularityfinance.ai/sfi-value-proposition/core-pillars-of-the-sfi-l2/sfi-vaults/architecture) describes the vault framework. [Execution Engine](https://docs.singularityfinance.ai/sfi-value-proposition/core-pillars-of-the-sfi-l2/sfi-vaults/features/execution-engine) describes human or algorithmic orders executed through an offchain server. Their publication or revision dates were not established. The post's former claim that only the planned L2 was documented was corrected.

The team also points to two 2023 SingularityDAO Medium posts, [From DynaSets to DynaVaults](https://medium.com/singularitydao/singularitydao-pv2-from-dynasets-to-dynavaults-18de22f4d372) and the [Deep Dive](https://medium.com/singularitydao/singularitydaos-pv2-new-dynavaults-deep-dive-9ad296383adc). They describe separate strategy contracts and Keeper execution after a technical audit and community vote. The onchain snapshot above found no configured strategies. The post also stopped treating the transaction sender as proof that a human chose each trade.

## 8 September 2026 SDK and deployed ABI review

The [npm registry](https://registry.npmjs.org/sfi-vault-sdk) records initial publication on 5 August and version 0.1.5 on 13 August. Its interfaces are not an exact ABI snapshot of the April deployments.

The [drain transaction](https://basescan.org/tx/0x00b949bc3ed3edb58b04faedfbd8eb1db2edceae761382e80fe012919f8d3732) succeeded in block 45,183,967. Historical RPC reads at 45,183,966 found the same bytecode as the September read for both EIP-1167 clones, their implementations and the abandoned Uniswap oracle. The vault clone points to [PermissionedDynaVault implementation `0xea7975c2fec1ae9e3058bb5f99d8e26dbc816811`](https://basescan.org/address/0xea7975c2fec1ae9e3058bb5f99d8e26dbc816811#code); its manager points to [DynaVaultManager implementation `0x95cf606f7e499549d83bd3c8a1e5d97fdf36688b`](https://basescan.org/address/0x95cf606f7e499549d83bd3c8a1e5d97fdf36688b#code). The vault's pre-drain reference oracle was `0x6Ea8e22AAfDeb8b537b59Fa857E2e49320EC5770`.

Comparison against the explorer-verified implementation ABIs ignored entry order, argument names and `internalType`, but checked recursive tuple types, outputs, mutability and event indexing:

| Interface | Deployed functions | SDK functions | SDK-only functions |
| --- | ---: | ---: | --- |
| PermissionedDynaVault | 77 | 78 | `toggleMerklOperator(address,address)` |
| DynaVaultManager | 93 | 101 | Eight deposit and circuit-breaker functions |

The eight manager additions are `checkAndTripDepositMintCircuitBreaker`, `checkDepositsAllowed`, `depositMintCircuitBreakerActive`, `depositMintCircuitBreakerInfo`, `depositsAllowed`, `maxReferenceValueDropBps`, `setDepositMintCircuitBreaker` and `setMaxReferenceValueDropBps`. They are absent from the drain-era manager interface. The SDK exports no oracle ABIs.

No deployed-only function, event or error was found. Shared functions had matching output types and mutability; shared events had matching indexed flags. This supports the shared reads used in the snapshots, not source-code equivalence or the existence of the SDK's additional protections in April. PublicNode rejected the historical receipt without a personal token; `https://mainnet.base.org` served the receipt and historical code reads.

Contract reads and transaction decoding resolve cached deployed ABIs by chain, address and runtime code hash. The SDK dependency and comparison tooling have been removed. Registry addresses live in `src/config.ts`, checked against the saved six-chain reads. The cache contains both drain-era clones, their implementations, ten linked libraries including the transitive `QueueLib`, the abandoned Uniswap oracle and the actual pre-drain reference oracle. Each dependency was checked at block 45,183,966. Commands and the explorer/RPC trust model are documented in the [README](README.md#verified-contract-cache).

Saved evidence: [vault dependencies](evidence/2026-09-08-drain-vault-cache.json), [manager dependencies](evidence/2026-09-08-drain-manager-cache.json), [Uniswap oracle](evidence/2026-09-08-drain-uniswap-cache.json), [reference oracle](evidence/2026-09-08-drain-reference-cache.json), [historical reference-oracle read](evidence/2026-09-08-drain-reference-read.json), and [reproduced ABI comparison](evidence/2026-09-08-drain-abi-review.json). The comparison reproduces the 77/78 and 93/101 function counts above, with no shared-signature mismatches.

The [fee-42 transaction](evidence/2026-09-08-fee42-verified-tx.json) decodes as `setUniV3fee(USDC, token, 42)` using the abandoned oracle's deployed ABI and has a successful receipt. The drain transaction itself targets attacker contract `0x9ad48257024f8cd3ab7fde97c95950159fcaefae`, with selector `0xc765f2d2`; it must not be assigned a vault ABI merely because it interacts with the vault.

Current-state validation: all nine Base production vaults were read through deployed ABIs in the [last schema-2 attempt](evidence/2026-09-08-verified-base-final.json). The run remains incomplete because Blockscout returned HTTP 429 for the Safe implementations and current oracle sources. [Earlier attempts](evidence/2026-09-08-verified-base.json) and the [first retry](evidence/2026-09-08-verified-base-retry.json) retain their raw errors. They are not comparison baselines. Independent Safe runtime detection was added after Blockscout returned `SafeL2` implementation sources under the governance proxy address with `IsProxy=false`; the resolver now reads slot zero and requires the actual implementation's cache.
