# Singularity Finance notebook

Onchain findings and sources for the [DynaVault post](https://hashfriend.eth.limo/singularity-finance-exploit/), organized by subject. Record event dates and block identities with each finding. Commands and interpretation rules live in the [README](README.md).

## Base address references

The admin account, governance and fee Safes, oracle addresses and role-hash encodings are defined in [src/config.ts](src/config.ts). The [vault snapshot](evidence/2026-09-08-viem.json) records full vault, manager and management-account addresses with their roles at the specified blocks.

- Management account `0x4dd226D874bdA38a2FFd55f39acE3829b0217CF0` submits `swapAndReport()` calls.
- Drained vault `dynBaseUSDCv3`: `0x67b93f6676bd1911c5fae7ffa90fff5f35e14dcd`; manager `0x478675aa4121c07825167bbb25a44aadd22bef7f`.
- Replacement vault `dynBaseUSDCv4`: `0x4C1fa73Ebc7Aa7C88006D51414fC5387dE3bfE26`; manager `0x077fb8b4…d4b9c6`; zapper `0x21527E64…5D4AB`.
- Abandoned UniswapV3Oracle: `0x73b8c192bfc323c3ea224c88219d55dfc319e89f`, with 46 fee-42 routes documented in the post.
- The replacement stack deployed on 18 July included the Uniswap and USDC reference oracles listed in the configuration, ERC4626Oracle `0x81e4a1c0…85ba5b` and ChainlinkOracle `0x7129e96f…668494`.

Resolve abbreviated addresses from evidence before making calls.

## August governance and vault state

Vault state below is as of 31 August 2026. Transaction links are in the [post timeline](https://hashfriend.eth.limo/singularity-finance-exploit/#timeline). A complete raw August snapshot is not included in this package.

- On 15 August, governance moved to a Safe initially configured with two owners and a threshold of one. The fee Safe had three owners and a threshold of two.
- On 18 August, `DEFAULT_ADMIN_ROLE` moved from the admin account to the governance Safe on OracleRegistry `0x184b2217…0be877` and ReferenceAssetOracle `0x6e03c0b5…bfc0f1`; `ORACLE_ADMIN` on the reference oracle moved too. The replacement UniswapV3Oracle `0x566bb935…c581fb` retained both roles with the admin account.
- On 19 August, the admin called `setPermissionDisabled(true)` on BNB Chain vaults dynBnbUSDC `0xa42c06e4…9200b7` and dynBnbBTCB `0xb6d476a6…38e0f5`. dynBnbUSDT, dynBnbBNB and every Ethereum and Arbitrum vault were still permissioned at this snapshot.
- On 24 August, the governance Safe added owner `0xB10E5A27…19a609E` and raised its threshold to two on Base and BNB Chain. Both instances had the same three owners and a 2-of-3 threshold. Guardian remained with the original admin account.
- Production inventory was 18 vaults: nine Base, three Ethereum, two Arbitrum and four BNB Chain. The Optimism and Polygon registries were empty.
- All 18 production managers returned only zero addresses from `getTokenStrategies()` and zero token debt. The management account continued to call `swapAndReport()`.
- dynBaseUSDCv3 reported 101.84 USDC against 427,285 shares; dynBaseUSDCv4 reported 1,166.27 USDC. No vault-side recapitalization was visible. This does not rule out undisclosed direct payments from an unknown address.

## Vault inventory and permissions

Evidence: [registry and vault state](evidence/2026-09-08-original.jsonl), [vault snapshot](evidence/2026-09-08-viem.json) and [gold-vault opening receipt](evidence/2026-09-05-gold-opening.json). The inventory reflects blocks dated 8 September 2026; the opening transaction occurred on 5 September. Use each file's block identity.

- Registry and vault state is pinned to Ethereum 25,932,311; Optimism 156,633,835; Arbitrum 503,005,461; BNB Chain 120,677,306; Polygon 93,440,949; Base 51,038,554. All six registry reads succeeded.
- Production inventory was 19: nine Base, three Ethereum, two Arbitrum and five BNB Chain vaults. Optimism and Polygon remained empty. All 19 had no configured strategies and zero token debt.
- New gold vault `dynBnbGold`, `0x2AbE7468F45a16e83fF6A3783180e9c532Bad197`, accepted the token named Tether Gold, `XAUt`, with six decimals at `0x21cAef8A43163Eea865baeE23b9C2E327696A3bf`. The admin disabled permissions on 5 September at 23:45:46 UTC in successful transaction `0x996c4ff71d08579d5203c2ecaaebff7dd54b0b6724ce0d08ebb2f759b8827e93`. Its manager `0x5E9359db317e1918B7FB4A4dc5083c156cC4d82D` retained governance and guardian with the admin account.
- `dynBnbUSDT`, `0x7eAa42F5138CA7d8c710C4238E590FA2d5623220`, returned `permissionDisabled=true`, unlike the August snapshot. Governance and guardian remained with the admin account. At BNB block 120,677,594, both USDT and Gold returned positive `maxDeposit()` for an address without `PERMITTED_USER`.
- Base and BNB governance Safes remained 2-of-3, with nonces three and one respectively. Base oracle roles were unchanged: registry and reference-oracle admin with the Safe, Uniswap oracle admin with the original account. All production guardians remained that account.
- Unresolved: the exact BNB USDT permission-opening transaction was not located. The state change is established between snapshots; its exact date is not.

## Project documentation

The official [Architecture](https://docs.singularityfinance.ai/sfi-value-proposition/core-pillars-of-the-sfi-l2/sfi-vaults/architecture) and [Execution Engine](https://docs.singularityfinance.ai/sfi-value-proposition/core-pillars-of-the-sfi-l2/sfi-vaults/features/execution-engine) pages describe vaults on SFI L2. The deployed production DynaVaults run on Base, Ethereum, Arbitrum and BNB Chain, not SFI L2. Those pages do not document the deployed vaults or establish how their trades are chosen. The pages' publication or revision dates were not established.

The team also points to two 2023 SingularityDAO Medium posts, [From DynaSets to DynaVaults](https://medium.com/singularitydao/singularitydao-pv2-from-dynasets-to-dynavaults-18de22f4d372) and the [Deep Dive](https://medium.com/singularitydao/singularitydaos-pv2-new-dynavaults-deep-dive-9ad296383adc). They describe separate strategy contracts and Keeper execution after a technical audit and community vote. The onchain snapshot above found no configured strategies.

## Deployed contracts

The [drain transaction](https://basescan.org/tx/0x00b949bc3ed3edb58b04faedfbd8eb1db2edceae761382e80fe012919f8d3732) succeeded in block 45,183,967. Cached verified sources were matched to the runtime bytecode at block 45,183,966 for both EIP-1167 clones, their implementations and the abandoned Uniswap oracle. The vault clone points to [PermissionedDynaVault implementation `0xea7975c2fec1ae9e3058bb5f99d8e26dbc816811`](https://basescan.org/address/0xea7975c2fec1ae9e3058bb5f99d8e26dbc816811#code); its manager points to [DynaVaultManager implementation `0x95cf606f7e499549d83bd3c8a1e5d97fdf36688b`](https://basescan.org/address/0x95cf606f7e499549d83bd3c8a1e5d97fdf36688b#code). The vault's pre-drain reference oracle was `0x6Ea8e22AAfDeb8b537b59Fa857E2e49320EC5770`.

The cache contains both drain-era clones, their implementations, ten linked libraries including the transitive `QueueLib`, the abandoned Uniswap oracle and the pre-drain reference oracle. Each dependency was checked at block 45,183,966.

Saved evidence: [vault dependencies](evidence/2026-04-25-drain-vault-cache.json), [manager dependencies](evidence/2026-04-25-drain-manager-cache.json), [Uniswap oracle](evidence/2026-04-25-drain-uniswap-cache.json), [reference oracle](evidence/2026-04-25-drain-reference-cache.json) and [historical reference-oracle read](evidence/2026-04-25-drain-reference-read.json).

The [fee-42 transaction](evidence/2026-01-19-fee42-verified-tx.json) decodes as `setUniV3fee(USDC, token, 42)` using the abandoned oracle's deployed ABI and has a successful receipt. The drain transaction itself targets attacker contract `0x9ad48257024f8cd3ab7fde97c95950159fcaefae`, with selector `0xc765f2d2`; it must not be assigned a vault ABI merely because it interacts with the vault.

Current-state validation: all nine Base production vaults were read through deployed ABIs in the [last schema-2 attempt](evidence/2026-09-08-verified-base-final.json). The run remains incomplete because Blockscout returned HTTP 429 for the Safe implementations and current oracle sources. [Earlier attempts](evidence/2026-09-08-verified-base.json) and the [first retry](evidence/2026-09-08-verified-base-retry.json) retain their raw errors. Blockscout returned `SafeL2` implementation sources under the governance proxy address with `IsProxy=false`; the actual implementation address is stored in slot zero.

## Historical onchain analysis

Use the existing [research commands](README.md#run) with the addresses, transactions and blocks below. Successful runs below supersede failed attempts for the same checks. A saved JSONL `runStatus.complete` covers only the requested checks, not exhaustive chain history; a missing final record means the run was interrupted.

### Drain and pool setup

The omitted preparation transaction is [`0xbd7be93f…235b4d`](https://basescan.org/tx/0xbd7be93fd468c8ddcd13b1fcd316bd832441831840a31578778ee0e94a235b4d), block 45,183,895, hash `0x563bc3ddf9efbbce4ff4a1ea78b4a9cf3404a444559a48df7716c200283ab828`, at 22:45:37 UTC on 25 April. Both it and the drain came from `0x5c2cbe53f2ce1b58532d4985a9b9d3db87d3af4c` to helper `0x9ad48257024f8cd3ab7fde97c95950159fcaefae`. The helper created five token/WETH pools at tier 3000 and initialized extreme prices without providing liquidity. This preceded the drain by 144 seconds.

| Checkpoint | Base block | `totalAssets()`, USDC |
| --- | ---: | ---: |
| Before pool setup | 45,183,894 | 449,521.508081 |
| Setup block, end of block | 45,183,895 | 449,521.508081 |
| 58 seconds after setup | 45,183,924 | 449,521.509990 |
| 60 seconds after setup | 45,183,925 | 100 |
| Immediately before drain | 45,183,966 | 100 |
| Drain block, end of block | 45,183,967 | 100 |

The old Uniswap oracle's `minLiquidityThreshold` was zero and `observationPeriod` was 60 seconds. Tier 42 returned no direct pool. Once the newly initialized WETH pools had sufficient observation history, their extreme prices rounded the five funded reserve prices to zero. Those results carried the nonzero initialization timestamp `1777157137`; `ReferenceAssetOracle.getPrice()` accepts a result when its timestamp is nonzero, without rejecting a zero value. Before that, its alternative pricing still produced values. The prior claim that the January settings alone left the vault valued at $100 for months was wrong.

The five funded positions were PUSDCHY, CPT48, maxUSD, ysUSDC and REN-USDC-B. tUSDC was configured but had zero balance and still had a nonzero reference price. The factory returned no PUSDCHY/USDC pool for tiers 100, 200, 400, 500, 3000 or 10000 at the pre-drain block. `feeAmountTickSpacing` returned nonzero values for those six tiers and zero for 42. These checks establish those specific tiers, not an unbounded enumeration of all possible fees.

The drain receipt and trace reproduce the 100,000 USDC Morpho loan, deposit of `100000000000` raw USDC, mint and burn of `420300912285322153666116992` raw vault shares, repayment, and a `413132022315` raw USDC transfer to `0x25c08505b6c5eba2d6c5d97c9e9a7f5f58d9a079`. Residual yield tokens were also transferred. Initial share supply in the trace was `420082292765729913584723`; fee minting during the deposit means the actual redemption ratio must use supply at redemption, not that initial supply alone.

`PermissionedDynaVault.redeemProportional()` calls `DynaVault.redeemProportional()`, which reports reserves and checks redemption before calling `DynaVaultLib.calcRedeemProportional()`. That calculation uses `shares * unlockedFundsRatio / totalSupply` and each token's `tokenIdle + tokenDebt`; `transferProportional()` pays the tokens. The sentence "redemption never consults the oracle" was wrong. Ordinary `redeem()` is a separate path and must not be treated as equivalent.

Evidence: [raw drain trace](evidence/2026-04-25-drain-trace.json), [drain receipt, decoded core calls and pre/post state](evidence/2026-04-25-drain-tenderly.jsonl), [raw pool-setup trace](evidence/2026-04-25-pool-setup-trace.json), [setup receipt, verified pool calls and pricing reads](evidence/2026-04-25-pricing-retry.jsonl), [58-second read](evidence/2026-04-25-price-58s.json), [60-second read](evidence/2026-04-25-price-60s.json). Both main analysis runs completed without errors. Blockscout traces were matched to RPC transaction inputs, senders, targets and receipts. The original helper entrypoints remain undecoded. Factory sources came from Blockscout; the five pools have address-specific Sourcify matches in `contracts/8453/`. Neither source provider substitutes for an independent compiler reproduction.

The [DarkNavy account](https://www.darknavy.org/web3/exploits/singularity-fi-dynbaseusdcv3-oracle-share-inflation/), saved in the [8 September source capture](evidence/2026-09-08-darknavy-review.json), omits the attacker's pool-creation transaction and says the oracle returned `(0, 0)` through missing or empty routes. The historical reads above instead establish prices rounded to zero with nonzero timestamps after the attacker-created pools had 60 seconds of history. The configuration alone did not reduce the vault to $100. The capture date does not establish DarkNavy's publication or revision date.

The post author subsequently supplied the [DefimonAlerts text](evidence/2026-09-08-defimon-user-excerpt.json). This is a user-supplied excerpt, not an independently retrieved X capture; the direct request returned HTTP 403. Defimon labels its research preliminary. Its account also omits the pool-creation step and attributes the low valuation to the disabled direct routes and zero-liquidity fallback pools. It lists only tiers 100, 500, 3000 and 10000, while the saved Base factory reads also found 200 and 400 enabled. Its approximate 99.99% share figure differs from the approximately 99.9% supported by the drain trace.

### Oracle configurations

The [two-page oracle history](evidence/2025-06-27_to_2026-01-19-oracle-history.json) contains a creation transaction and 60 direct configuration transactions. [Transaction checks](evidence/2025-06-27_to_2026-04-25-oracle-tenderly.jsonl) checked all 60 receipts, inputs, block identities and historical oracle bytecode. Fourteen initial calls used enabled tiers. The subsequent 46 calls set 46 distinct pairs to 42, all from the admin EOA: two on 13 September 2025, 24 on 4 December, 14 on 17 December, and six on 19 January 2026. The six January calls ran from 06:37:03 to 06:37:51 UTC. All 46 pair settings remained 42 at block 45,183,966.

This confirms repeated invalid direct-route configuration. It does not show that all oracle fallbacks returned zero throughout those months, nor does a complete indexer page sequence exclude internal configuration calls.

### Trading counts

The original figures entered the post in commit `9abbd99` on 21 August, without a saved query or cutoff. The [v3](evidence/2026-01-17_to_2026-08-15-v3-history.json) and [v4](evidence/2026-07-24_to_2026-09-08-v4-history.json) exports reach the indexer's last page. [Recounting](evidence/2026-01-17_to_2026-08-20-trading.jsonl) deduplicates transaction hashes, decodes selector `0x0b2fbca1` against the deployed vault ABIs, and selects successful direct calls before 21 August 2026 00:00 UTC. Boundary transaction receipts and canonical block identities were checked. This is an indexer-backed count of direct calls, not a complete internal-call scan.

| Window through 20 August | Management account | All direct swaps |
| --- | ---: | ---: |
| v3 indexed history | 575 | 751 |
| v3 latest 323 | 273 | 323 |
| v4 indexed history | 184 | 218 |
| v4 latest 139 | 134 | 139 |
| v4 first 139 | 110 | 139 |

The original numerators reproduce exactly in truncated latest-call windows. Calling 323 v3's total and 139 v4's first swaps was wrong. Sender attribution does not identify whether trading decisions were human or algorithmic.

### Governance and fees

[Base governance reads](evidence/2026-08-15_to_2026-08-24-governance-retry.jsonl) confirms the v3/v4 manager handovers on 15 August, the Safe's initial two owners and threshold one, and its change to three owners and threshold two in block 50,394,905 on 24 August. The managers' guardian remained the original EOA. [Oracle-role reads](evidence/2026-08-18_to_2026-09-08-roles.jsonl) verify the cited August revocations and the retained single-account roles on the replacement Uniswap oracle. These runs completed without errors, using the actual Safe implementation and oracle sources, filling the earlier Base cache gaps.

[Fee-Safe reads](evidence/2026-01-16_to_2026-09-08-fees.jsonl) at block 51,038,969 confirm four owners, threshold two and a drained-vault share valuation of 1.364935 USDC. January reads confirm an owner addition and removal on 16 January, ending with three owners then. [Incoming fee-Safe transactions](evidence/2026-01-16-fee-safe-history.json) alone do not establish all Safe activity, and cannot prove the absence of share redemptions.

The 16 January addition raised the owner count from three to four at block 40,889,668, but the removal at block 40,889,696 returned it to three. The September owner list adds `0xB10E5A27A9f4c8eFdeB1AE1B415A0fBa019a609E` to those remaining January owners. The saved evidence does not date that later addition. The post's former three-owner description was therefore wrong for the verified September state; the four-owner read does not establish an appointment on 8 September.

The all-history fee-share audit remains incomplete. Explorer results hit a 1,000-log cap and then HTTP 429; the [split-range retry](evidence/2026-01-16_to_2026-09-08-fees-retry.jsonl) also retains HTTP 429 errors. Public RPCs rejected wide log ranges. No failed query was interpreted as zero transfers. The dated share valuation and enabled fee settings do not establish cash recoverability or a reimbursement fund.

The [bounded July 29 fee-allocation scan](evidence/2026-07-29-fee-accrual-corrected.jsonl) did complete. It covers blocks 49,246,927 through 49,290,126, the full UTC day, and checks the known drain fee transfer at log 469 as a positive control. Two transactions transferred a combined `391508196734193206` raw shares from the vault to the Safe, exactly matching its balance increase from `4707383121953328338255` to `4707774630150062531461`. The vault's reported assets were 101.303008 USDC before the day and 101.303282 USDC at its end. The [first scan](evidence/2026-07-29-fee-accrual.jsonl) used the wrong filter, mint directly to Safe; its empty result is not evidence of no allocation. Actual fee shares are minted to the vault and then transferred to the Safe. Use the corrected scan.

BNB [Safe hardening](evidence/2026-08-24-bnb-safe.json), [USDC opening](evidence/2026-08-19-bnb-usdc-opening.json) and [BTCB opening](evidence/2026-08-19-bnb-btcb-opening.json) receipts were retrieved successfully. Address-specific historical decoding remains incomplete because public BNB endpoints rejected archive code/state reads. These files retain raw receipts and explicit decoding errors; they are not deployed-ABI proofs. Further historical reads need a working BNB archive endpoint. No inference is made that publication caused any governance change, and this onchain pass does not independently establish Telegram announcement history.
