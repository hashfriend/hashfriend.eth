# Singularity Finance notebook

Evidence and sources for the [DynaVault post](https://hashfriend.eth.limo/singularity-finance-exploit/), organized by subject. Record event dates and block identities with each finding. Commands and interpretation rules live in the [README](README.md).

## Base address references

The admin account, governance and fee Safes, oracle addresses and role-hash encodings are defined in [src/config.ts](src/config.ts). The [vault snapshot](evidence/2026-09-08-viem.json) records full vault, manager and management-account addresses with their roles at the specified blocks.

- Management account `0x4dd226D874bdA38a2FFd55f39acE3829b0217CF0` submits `swapAndReport()` calls.
- Drained vault `dynBaseUSDCv3`: `0x67b93f6676bd1911c5fae7ffa90fff5f35e14dcd`; manager `0x478675aa4121c07825167bbb25a44aadd22bef7f`.
- Replacement vault `dynBaseUSDCv4`: `0x4C1fa73Ebc7Aa7C88006D51414fC5387dE3bfE26`; manager `0x077fb8b4…d4b9c6`; zapper `0x21527E64…5D4AB`.
- Abandoned UniswapV3Oracle: `0x73b8c192bfc323c3ea224c88219d55dfc319e89f`, with 46 fee-42 routes documented in the post.
- The replacement stack deployed on 18 July included the Uniswap and USDC reference oracles listed in the configuration, ERC4626Oracle `0x81e4a1c0…85ba5b` and ChainlinkOracle `0x7129e96f…668494`.

Resolve abbreviated addresses from evidence before making calls.

## April freeze and July reopening

The [post timeline](https://hashfriend.eth.limo/singularity-finance-exploit/#timeline) and [The Silent Reopening](https://hashfriend.eth.limo/singularity-finance-exploit/#the-silent-reopening) document the freeze, the July unfreezes and the team's replies. Dates below refer to events in 2026.

- On 26 April, the team [announced the exploit and freeze](https://t.me/Singularity_Fi/262366). The admin called `setPermissionDisabled(false)` on the seven other Base vaults in blocks 45,186,146 through 45,186,236. The [freeze receipts](evidence/2026-04-26_to_2026-07-24-vault-controls.json) cover dynBaseUSDC, dynBaseUSDCv2, dynBaseWETH, dynBaseBTC, dynBaseEURC, dynBaseEURCv2 and dynBaseWETHv2. Each call succeeded and restored the whitelist requirement for deposits and withdrawals.
- On 18 July, the team deployed the replacement oracle stack. On 19 July, it repointed all eight original Base vaults in blocks 48,834,245 through 48,834,787. The [migration receipts](evidence/2026-04-26_to_2026-07-24-vault-controls.json) and [oracle-update events](evidence/2026-04-25_to_2026-07-19-freeze-and-oracle-events.json) identify every vault and its new reference oracle: USDC `0x6e03c0b5…bfc0f1`, WETH `0x9dDC18BF…BA8652`, EURC `0x158961d8…1793dC` and cbBTC `0x00De8B69…C54482`.
- On 20 July, the admin disabled the permission check on seven existing Base vaults, including the drained dynBaseUSDCv3. On 22 July, it did the same for dynBaseBTC. These are the eight vault unfreezes described in the post. The permission changes did not restore the drained vault's lost assets.

The [reopening receipts](evidence/2026-07-20_to_2026-07-22-base-reopenings.json) and [complete permission-event scan](evidence/2026-07-19_to_2026-07-23-permission-events.json) identify each unfreeze. Every transaction came from admin account `0xcd231d4ba7B15A4722ac057419D9cd7689e7b8db` and called `setPermissionDisabled(true)`. In the cached `PermissionedDynaVault` source, this disables the `PERMITTED_USER` check on deposits, withdrawals and redemptions.

| Vault | Reopening date | Base block | Transaction |
| --- | --- | ---: | --- |
| dynBaseWETH | 20 July | 48,876,670 | [0x3f398104…e74e33e0](https://basescan.org/tx/0x3f3981041b1b5a8f83934cb2e226c88a506ecb1b77d0b937a976ce5ae74e33e0) |
| dynBaseUSDCv2 | 20 July | 48,876,716 | [0x5df40ab0…70179c24](https://basescan.org/tx/0x5df40ab0a6102e8ff4e4a8575863a080e8c75a0a26a732d0de48270670179c24) |
| dynBaseUSDC | 20 July | 48,876,745 | [0xe9d6c1cd…d6cfd24e](https://basescan.org/tx/0xe9d6c1cde2796b45bc05c630d9434fe28724057328935842f6533549d6cfd24e) |
| dynBaseEURC | 20 July | 48,876,767 | [0x55dc1e2b…a26bab89](https://basescan.org/tx/0x55dc1e2b91f58abae045cf35ae5f54ce0da97a4916428406cfbfb212a26bab89) |
| dynBaseEURCv2 | 20 July | 48,876,795 | [0x546586e7…8eb4f627](https://basescan.org/tx/0x546586e74b0308b308c87e7b49f21e26e9afd2d4ab5dfaa0687b239c8eb4f627) |
| dynBaseWETHv2 | 20 July | 48,876,825 | [0x305301ed…0628050d](https://basescan.org/tx/0x305301ed4d3c5de58f3d434adfaf9f77ffd0b420df16a6595c2377db0628050d) |
| dynBaseUSDCv3 | 20 July | 48,876,853 | [0xce2d9004…5861e452](https://basescan.org/tx/0xce2d900424f166db5bbd51178b6d8dde134f51fc839cb92602341b525861e452) |
| dynBaseBTC | 22 July | 48,983,079 | [0x94c78b7e…9ffa321e](https://basescan.org/tx/0x94c78b7ef373a1a4b8c209a451155235857997ceb5331bcaa324c5de9ffa321e) |

The [attempt to set dynBaseWETHv2's oracle to the USDC reference oracle](https://basescan.org/tx/0x506263bbc9546b1ccca82894dedc543dfe7b68fb45a883b1c7481187234b2b03) reverted in block 48,834,400. The [successful update](https://basescan.org/tx/0xf98247c447093e069185516e44f371c67c33e4a8076db4904efc36b7af4d3126) in block 48,834,558 set the WETH reference oracle. `VaultConfigLib.setReferenceAssetOracle()` rejects a reference-asset mismatch with `NotSameReferenceAsset()`. The failed transaction never changed the vault's oracle.

- On 20 July, the admin granted `PERMITTED_USER` to zapper `0x21527E64545C14BD340A48013FF073A2D055D4AB` on dynBaseUSDCv3 in [block 48,876,848](https://basescan.org/tx/0xb5bde9f190f240aa54b676af79f30eca5cc5007f0e914adc507bbbde13a41303), before disabling permissions for everyone in block 48,876,853.
- On 24 July, the replacement dynBaseUSDCv4 began accruing fees while remaining permissioned. The [access-grant receipts](evidence/2026-04-26_to_2026-07-24-vault-controls.json) record thirteen wallet grants in blocks 49,046,191 through 49,046,675, plus earlier `PERMITTED_USER` grants to the admin and zapper. These grants were separate from reopening the eight existing vaults. The replacement held none of the funds frozen in April.

## Team statements and post-mortem promises

- On 26 April, the [exploit announcement](https://t.me/Singularity_Fi/262366) blamed a Morpho flash loan for oracle-price manipulation and promised a post-mortem the next day. The transaction evidence shows that the flash loan funded the deposit after the attacker had manipulated prices.
- Between May and July, the team privately acknowledged that the oracle caused the exploit, said publishing could expose other areas to risk while it strengthened the oracles, and cited its lean team. By July, it refused to discuss the onchain findings further. The exchanges are recorded in [The Team's Response](https://hashfriend.eth.limo/singularity-finance-exploit/#the-teams-response).
- On 30 and 31 July, the team cited [whitelisted oracle testers](https://t.me/Singularity_Fi/264052), [the replacement vault](https://t.me/Singularity_Fi/264060), [beta testing](https://t.me/Singularity_Fi/264063) and [frontend fixes](https://t.me/Singularity_Fi/264067) when asked about reopening. The team [acknowledged delaying the reopening announcement](https://t.me/Singularity_Fi/264060) so it could accompany the post-mortem, which it promised for early the following week.
- On 2 August, a user in the unofficial price channel asked when the vaults would reopen. The team [confirmed they had reopened](https://t.me/SFIprice/18484), thirteen days after the first unfreezes, and repeated the post-mortem promise. By 10 August, the promised publication windows had passed without the report or a general reopening announcement, as recorded in the post.
- On 14 August, the team [said it was waiting for the engineering team's green light](https://t.me/Singularity_Fi/264354), without another publication date.
- On 21 August, the team added approval by a third-party investigator to the reasons for withholding the report. It also [described the vaults as having automated execution but not being autonomous](https://t.me/Singularity_Fi/264606).
- On 23 August, the team [casually mentioned a recovery-fund plan](https://t.me/Singularity_Fi/264665), [said it would arrive before year-end](https://t.me/Singularity_Fi/264666), and [said it would be done soon](https://t.me/Singularity_Fi/264668). It gave no funding amount, source or reimbursement terms.
- By 8 September, the team had published neither the post-mortem nor reimbursement terms. The four outstanding questions concern the oracle settings, who chose them and why, publication of the report, and reimbursement from project funds or collected fees.

## Governance and retained admin powers

The [governance transactions](evidence/2026-08-15_to_2026-08-24-governance-retry.jsonl), [oracle-role reads](evidence/2026-08-18_to_2026-09-08-roles.jsonl) and [8 September Base snapshot](evidence/2026-09-08-base-snapshot.json) record the handovers and remaining single-account powers.

- On 15 August, governance of the v3 and v4 managers moved to a Safe initially configured with two owners and a threshold of one.
- On 18 August, `DEFAULT_ADMIN_ROLE` moved from the admin account to the governance Safe on OracleRegistry `0x184b2217…0be877` and ReferenceAssetOracle `0x6e03c0b5…bfc0f1`; `ORACLE_ADMIN` on the reference oracle moved too. The replacement UniswapV3Oracle `0x566bb935…c581fb` retained both roles with the admin account.
- On 24 August, the governance Safe added owner `0xB10E5A27…19a609E` and raised its threshold to two on Base and BNB Chain. Both instances had the same three owners and a 2-of-3 threshold. Guardian remained with the original admin account.
- At Base block 51,040,105 on 8 September, the governance Safe had three owners and a threshold of two. The admin still held the guardian role on every Base production manager and both admin roles on the replacement Uniswap oracle.
- The guardian can activate emergency shutdown. The replacement oracle's `setUniV3fee(address,address,uint24)` writes the supplied fee in both directions without checking whether the factory enabled that tier. Moving governance to a Safe does not remove these powers.

## Continued development while the report was delayed

New vaults matter here as evidence of the team's priorities. The team continued deploying, opening and operating products while citing limited capacity and leaving the promised post-mortem unpublished. No official statement if all those newly deployed vaults are different from the exploited vault code.

- The replacement USDC vault was operating on 24 July. By 14 August, the dApp listed six new beta vaults on three more chains.
- On 19 August, the admin opened [dynBnbUSDC](evidence/2026-08-19-bnb-usdc-opening.json) and [dynBnbBTCB](evidence/2026-08-19-bnb-btcb-opening.json). On 5 September, it [opened dynBnbGold](evidence/2026-09-05-gold-opening.json).
- The registered production total rose from 18 vaults on 31 August to 19 by 8 September. The [six-chain snapshot](evidence/2026-09-08-viem.json) records nine on Base, three on Ethereum, two on Arbitrum and five on BNB Chain, with none on Optimism or Polygon. Full addresses and per-vault settings remain in that evidence file.

## Project documentation

The official [Architecture](https://docs.singularityfinance.ai/sfi-value-proposition/core-pillars-of-the-sfi-l2/sfi-vaults/architecture) and [Execution Engine](https://docs.singularityfinance.ai/sfi-value-proposition/core-pillars-of-the-sfi-l2/sfi-vaults/features/execution-engine) pages describe vaults on a fictional SFI L2. The deployed production DynaVaults run on Base, Ethereum, Arbitrum and BNB Chain. Those pages do not document the deployed vaults or establish how their trades are chosen.

The team points to two 2023 SingularityDAO Medium posts, [From DynaSets to DynaVaults](https://medium.com/singularitydao/singularitydao-pv2-from-dynasets-to-dynavaults-18de22f4d372) and the [Deep Dive](https://medium.com/singularitydao/singularitydaos-pv2-new-dynavaults-deep-dive-9ad296383adc). They describe separate strategy contracts and Keeper execution after a technical audit and community vote. All 19 production vaults in the 8 September snapshot had no configured strategies and zero token debt. No evidence of any community votes to be found.

The [sdao.eth Snapshot record](evidence/2022-02-28_to_2024-12-09-sdao-proposals.json) contains 11 proposals, dated 28 February 2022 through 9 December 2024. The [21 October merger proposal](https://snapshot.org/#/sdao.eth/proposal/0xa49a283ff57d9723e6637b19d3a803d63fef0de7f24e9cdfefc7af57f011af3d) and [9 December revised merger proposal](https://snapshot.org/#/sdao.eth/proposal/0x6aa0b5a6b071a815da270c36707ecc4c2e0840fd9dfdfbbabec3212a0689e569) mention DynaVaults as a planned product. Their voting questions concern the merger and tokenomics. None of the 11 proposal titles or bodies requests approval of the deployed DynaVaults or their strategies.

## Deployed contracts

The [drain transaction](https://basescan.org/tx/0x00b949bc3ed3edb58b04faedfbd8eb1db2edceae761382e80fe012919f8d3732) succeeded in block 45,183,967. Cached verified sources were matched to the runtime bytecode at block 45,183,966 for both EIP-1167 clones, their implementations and the abandoned Uniswap oracle. The vault clone points to [PermissionedDynaVault implementation `0xea7975c2fec1ae9e3058bb5f99d8e26dbc816811`](https://basescan.org/address/0xea7975c2fec1ae9e3058bb5f99d8e26dbc816811#code); its manager points to [DynaVaultManager implementation `0x95cf606f7e499549d83bd3c8a1e5d97fdf36688b`](https://basescan.org/address/0x95cf606f7e499549d83bd3c8a1e5d97fdf36688b#code). The vault's pre-drain reference oracle was `0x6Ea8e22AAfDeb8b537b59Fa857E2e49320EC5770`.

The cache contains both drain-era clones, their implementations, ten linked libraries including the transitive `QueueLib`, the abandoned Uniswap oracle and the pre-drain reference oracle. Each dependency was checked at block 45,183,966.

Saved evidence: [vault dependencies](evidence/2026-04-25-drain-vault-cache.json), [manager dependencies](evidence/2026-04-25-drain-manager-cache.json), [Uniswap oracle](evidence/2026-04-25-drain-uniswap-cache.json), [reference oracle](evidence/2026-04-25-drain-reference-cache.json) and [historical reference-oracle read](evidence/2026-04-25-drain-reference-read.json).

The [fee-42 transaction](evidence/2026-01-19-fee42-verified-tx.json) decodes as `setUniV3fee(USDC, token, 42)` using the abandoned oracle's deployed ABI and has a successful receipt. The drain transaction itself targets attacker contract `0x9ad48257024f8cd3ab7fde97c95950159fcaefae`, with selector `0xc765f2d2`; it must not be assigned a vault ABI merely because it interacts with the vault.

The [complete Base snapshot](evidence/2026-09-08-base-snapshot.json) at block 51,040,105 covers all nine production vaults, both Safes and all three current oracle contracts through their deployed ABIs. The block hash is `0x47e3bc43fc2e9f54a8bec7b2d51f183fd53fc0913d9a01bc4f4b5f06705526bb`. Safe proxies resolve through the implementation address in storage slot zero.

## Historical onchain analysis

Use the [research commands](README.md#run) with the addresses, transactions and blocks below.

### Drain and pool setup

The [pool-creation transaction](https://basescan.org/tx/0xbd7be93fd468c8ddcd13b1fcd316bd832441831840a31578778ee0e94a235b4d) occurred on 25 April in block 45,183,895, hash `0x563bc3ddf9efbbce4ff4a1ea78b4a9cf3404a444559a48df7716c200283ab828`. Both it and the drain came from `0x5c2cbe53f2ce1b58532d4985a9b9d3db87d3af4c` to helper `0x9ad48257024f8cd3ab7fde97c95950159fcaefae`. The helper created five token/WETH pools at tier 3000 and initialized extreme prices without providing liquidity.

| Checkpoint | Base block | `totalAssets()`, USDC |
| --- | ---: | ---: |
| Before pool setup | 45,183,894 | 449,521.508081 |
| Setup block, end of block | 45,183,895 | 449,521.508081 |
| 58 seconds after setup | 45,183,924 | 449,521.509990 |
| 60 seconds after setup | 45,183,925 | 100 |
| Immediately before drain | 45,183,966 | 100 |
| Drain block, end of block | 45,183,967 | 100 |

The old Uniswap oracle's `minLiquidityThreshold` was zero and `observationPeriod` was 60 seconds. Tier 42 returned no direct pool. Once the newly initialized WETH pools had sufficient observation history, their extreme prices rounded the five funded reserve prices to zero. Those results carried the nonzero initialization timestamp `1777157137`; `ReferenceAssetOracle.getPrice()` accepts a result when its timestamp is nonzero, without rejecting a zero value. Before that, alternative pricing still produced values. The January settings alone did not leave the vault valued at $100 for months.

The five funded positions were PUSDCHY, CPT48, maxUSD, ysUSDC and REN-USDC-B. tUSDC was configured but had zero balance and still had a nonzero reference price. The factory returned no PUSDCHY/USDC pool for tiers 100, 200, 400, 500, 3000 or 10000 at the pre-drain block. `feeAmountTickSpacing` returned nonzero values for those six tiers and zero for 42. These checks establish those specific tiers, not an unbounded enumeration of all possible fees.

The drain receipt and trace reproduce the 100,000 USDC Morpho loan, deposit of `100000000000` raw USDC, mint and burn of `420300912285322153666116992` raw vault shares, repayment, and a `413132022315` raw USDC transfer to `0x25c08505b6c5eba2d6c5d97c9e9a7f5f58d9a079`. Residual yield tokens were also transferred. Initial share supply in the trace was `420082292765729913584723`; fee minting during the deposit means the actual redemption ratio must use supply at redemption, not that initial supply alone.

`PermissionedDynaVault.redeemProportional()` calls `DynaVault.redeemProportional()`, which reports reserves and checks redemption before calling `DynaVaultLib.calcRedeemProportional()`. That calculation uses `shares * unlockedFundsRatio / totalSupply` and each token's `tokenIdle + tokenDebt`; `transferProportional()` pays the tokens. Ordinary `redeem()` follows a separate path.

Evidence: [raw drain trace](evidence/2026-04-25-drain-trace.json), [drain receipt, decoded core calls and pre/post state](evidence/2026-04-25-drain-tenderly.jsonl), [raw pool-setup trace](evidence/2026-04-25-pool-setup-trace.json), [setup receipt, verified pool calls and pricing reads](evidence/2026-04-25-pricing-retry.jsonl), [58-second read](evidence/2026-04-25-price-58s.json) and [60-second read](evidence/2026-04-25-price-60s.json). The traces match RPC transaction inputs, senders, targets and receipts.

The [DarkNavy account](https://www.darknavy.org/web3/exploits/singularity-fi-dynbaseusdcv3-oracle-share-inflation/), saved in the [source capture](evidence/2026-09-08-darknavy-review.json), omits the attacker's pool-creation transaction and says the oracle returned `(0, 0)` through missing or empty routes. The historical reads establish zero prices with nonzero timestamps after the attacker-created pools had 60 seconds of history.

The [DefimonAlerts account](evidence/2026-09-08-defimon-user-excerpt.json) identifies the zero-liquidity WETH fallback pools but omits the attacker's pool-creation step. It lists only tiers 100, 500, 3000 and 10000, while the Base factory reads also found 200 and 400 enabled. Its approximate 99.99% share figure differs from the approximately 99.9% supported by the drain trace.

### Oracle configurations

The [oracle history](evidence/2025-06-27_to_2026-01-19-oracle-history.json) contains a creation transaction and 60 direct configuration transactions. [Transaction checks](evidence/2025-06-27_to_2026-04-25-oracle-tenderly.jsonl) cover all 60 receipts, inputs, block identities and historical oracle bytecode. Fourteen initial calls used enabled tiers. The subsequent 46 calls set 46 distinct pairs to 42, all from the admin EOA: two on 13 September 2025, 24 on 4 December, 14 on 17 December, and six on 19 January 2026. All 46 pair settings remained 42 at block 45,183,966.

The [replacement-oracle reads](evidence/2026-07-19-replacement-oracle-fees.json) check those 60 pairs at block 48,858,126 on 19 July. Three had configured routes: USDT/USDC and WETH/USDC at fee 100, and cbBTC/USDC at fee 500. The factory returned tick spacings of one and ten for those tiers. The other 57 pairs were unset in the replacement Uniswap oracle.

### Trading counts

The [trading count](evidence/2026-01-17_to_2026-08-20-trading.jsonl) deduplicates the [v3](evidence/2026-01-17_to_2026-08-15-v3-history.json) and [v4](evidence/2026-07-24_to_2026-09-08-v4-history.json) histories, decodes selector `0x0b2fbca1` against the deployed vault ABIs, and selects successful direct calls before 21 August 2026 00:00 UTC. The caller supplies the trade to `swapAndReport()`, which executes it and updates the accounting.

| Window through 20 August | Management account | All direct swaps |
| --- | ---: | ---: |
| v3 indexed history | 575 | 751 |
| v4 indexed history | 184 | 218 |

Sender attribution does not identify whether a person or software chose the trades.

### Fee Safe and post-exploit fee allocation

[Fee-Safe reads](evidence/2026-01-16_to_2026-09-08-fees.jsonl) at block 51,038,969 on 8 September confirm four owners, threshold two and a drained-vault share valuation of 1.364935 USDC. On 16 January, an owner addition and removal in blocks 40,889,668 and 40,889,696 left three owners. The [8 September Base snapshot](evidence/2026-09-08-base-snapshot.json) also records the four-owner Safe and the drained vault's enabled fee settings. The share valuation does not establish funds available for reimbursement elsewhere.

The [29 July fee-allocation scan](evidence/2026-07-29-fee-accrual-corrected.jsonl) covers blocks 49,246,927 through 49,290,126, the full UTC day, and checks the known drain fee transfer at log 469 as a positive control. Two transactions transferred a combined `391508196734193206` raw shares from the vault to the Safe, exactly matching its balance increase from `4707383121953328338255` to `4707774630150062531461`. The vault's reported assets were 101.303008 USDC before the day and 101.303282 USDC at its end. Fee shares are minted to the vault and then transferred to the Safe.
