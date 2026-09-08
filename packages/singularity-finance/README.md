# Singularity Finance research

Read-only tooling for the [DynaVault post](../web/src/pages/singularity-finance-exploit.md). Uses viem, cached address-specific deployed ABIs and registry addresses in [src/config.ts](src/config.ts). No wallet, signing, deployment or Telegram automation.

[NOTEBOOK.md](NOTEBOOK.md) holds the dated investigation log, source findings, address references and open checks. Contract reads and transaction decoding use the [verified cache resolver](src/contracts.ts); missing evidence fails explicitly.

Commands to be run from `packages/singularity-finance`:

```bash
bun run research cache-snapshot --chain base --out evidence/base-baseline.json
bun run research snapshot --chain base --out evidence/YYYY-MM-DD-base.json
bun run research diff evidence/base-baseline.json evidence/YYYY-MM-DD-base.json
bun run research gates 0x67b93f6676bd1911c5fae7ffa90fff5f35e14dcd --chain base
bun run research tx 0x2df0be7a17bd69a2f732c1396796690240aecdfaf13b0a8f60f49f95a8dbe150 --chain base
bun run research block --chain bnb --block 120200878
bun run research call 0x67b93f6676bd1911c5fae7ffa90fff5f35e14dcd permissionDisabled --chain base
bun run research history 0xcd231d4ba7B15A4722ac057419D9cd7689e7b8db --chain base --direction from --pages 2
bun run research source 0x566bb935a22f6b18f351d79ea54e9fa83fc581fb --out evidence/uniswap-source.json
bun run research document https://docs.singularityfinance.ai/sfi-value-proposition/core-pillars-of-the-sfi-l2/sfi-vaults/features/execution-engine.md --out evidence/execution-engine.json
bun run research selector 'setPermissionDisabled(bool)'
bun run research --help
```

JSON goes to stdout or `--out`. Output files are created exclusively; choose a new name for each run. Root lint and typecheck include this package; run its tests with `bun run --filter @hashfriend/singularity-finance test`.

## Investigation workflow

1. Read existing evidence and the contract cache before fetching again. `snapshot` uses cached ABIs; `cache-snapshot` explicitly populates missing artifacts first. Use `--chain base --block NUMBER` for a pinned recheck. Public RPCs may reject historical reads; set `SFI_RPC_<chainId>` to override an endpoint when needed. No environment file is required. Six-chain discovery remains available, but completion requires verified caches for every read target.
2. Compare schema-2 snapshots with the same chain selection and ABI policy. Snapshots record block numbers, hashes and timestamps, ABI evidence, registry entries, exclusions, roles, Safe thresholds, fees, assets, shares, permission probes and each token's strategies and debt. `complete` means these configured checks succeeded, not that every protocol risk was examined. Failed reads remain errors, the command exits nonzero, and `diff` refuses incomplete evidence and older snapshots.
3. Resolve material changes to transactions. `history` preserves bounded indexer pages; `tx` decodes against the actual transaction target's cached ABI and checks its receipt and canonical block. Unknown selectors or missing artifacts preserve raw transaction/receipt data with `complete: false` and exit 1. A decoded call is not proof of success without the receipt. Transaction decoding uses end-of-block proxy state, so an intra-block upgrade requires a transaction-level trace and is not resolved by this command. BNB receipt reads use Binance's public RPC unless overridden. `block` retrieves full transactions when indexers omit calls. `call` takes a verified view/pure function name and optional JSON `--args`; encode large integers as strings.
4. Check current official docs and the user's Telegram evidence separately. `document` records retrieval time, not publication time. For Medium pages that return 403, pass `https://r.jina.ai/https://medium.com/...` explicitly.
5. Record dated findings, supporting evidence and unresolved checks in [NOTEBOOK.md](NOTEBOOK.md). Update the post only for material findings or elapsed times, following the editorial guidance in `memory/singularity-finance-post.md`. Keep command instructions here.

The production count follows the post's existing convention: Base registry types 3 and 4, then symbols starting with `dyn` and excluding `Test` on every chain. Raw registry entries and exclusions remain in each snapshot so this filter can be reviewed when new types appear. Inactive registered vaults remain counted. An empty registry must be a successful RPC response.

An ordinary account sending trades does not establish whether humans or software chose them. Zero configured strategies is a separate observation. Single-key guardian and Uniswap oracle roles remain separate from Safe governance. Asset changes alone do not establish theft, losses or reimbursement.

Role hashes use different Solidity encodings: `PermissionedDynaVault` uses `keccak256("PERMITTED_USER")`, while `UniswapV3Oracle` uses `keccak256(abi.encode("ORACLE_ADMIN"))`. [The configuration](src/config.ts) implements both, and [the tests](src/research.test.ts) guard that distinction. ABI compatibility establishes call encoding, not identical contract logic; drain analysis requires the deployed implementations, linked libraries and historical state.

Base history uses Blockscout pagination. BNB history requires `SFI_3XPL_TOKEN` and uses 3xpl's recent-page indexes `-0`, `-1`, and so on. Both can omit transactions; neither is a complete chain scan. Keep API tokens and private RPC URLs out of evidence and commits. All HTTP requests use the repository's Safari User-Agent and bounded timeouts.

## Saved evidence

`evidence/2026-09-08-original.jsonl` preserves the temporary script's original reads used for the September post update. It has no block hashes. `evidence/2026-09-08-viem.json` preserves the first complete six-chain snapshot, made with SDK ABIs. Both remain historical evidence, but neither is accepted as a schema-2 comparison baseline. Amounts are decimal strings; token decimals and formatted totals are included in new snapshots.

## Verified contract cache

Artifacts live in `contracts/<chainId>/<address>/<runtime-code-hash>.json`. Each contains runtime bytecode, the observed block, explorer source URL and retrieval time, ABI, compiler settings, Solidity files and linked-library addresses. Libraries are resolved recursively, including their own dependencies.

The resolver checks code at the requested block, follows standard EIP-1167 clones, EIP-1967 implementation slots and supported Safe proxies, and checks every implementation/library dependency. Unsupported proxies and missing source evidence fail. Explorer proxy labels are insufficient: Blockscout can return implementation sources under the proxy's address, so recognized clone and Safe runtime code is resolved independently. On cache creation, current and historical runtime must match before accepting the explorer's current verified source. This relies on explorer verification and RPC accuracy; it is not a local compiler reproduction. Existing historical artifacts are reused by runtime hash.

`cache ADDRESS --chain NAME --block NUMBER` populates a root and its dependencies. Repeated `--source FILE` flags reuse previously saved `source` command bundles, preserving their original retrieval times. `source` alone archives a raw Base explorer response; it does not bind an ABI to historical bytecode. Source fetching currently supports the configured Blockscout endpoints for Base, Ethereum, Optimism, Arbitrum and Polygon. BNB has no configured verified-source provider and fails explicitly; no complete replacement six-chain baseline is claimed. Standard ERC-20 `symbol` and `decimals` calls in snapshots are token metadata reads, not verified-source analysis of those tokens.

The drain-era roots are already cached. Recheck them at the block immediately before the drain:

```bash
SFI_RPC_8453=https://mainnet.base.org bun run research cache 0x67b93f6676bd1911c5fae7ffa90fff5f35e14dcd --chain base --block 45183966
SFI_RPC_8453=https://mainnet.base.org bun run research cache 0x478675aa4121c07825167bbb25a44aadd22bef7f --chain base --block 45183966
SFI_RPC_8453=https://mainnet.base.org bun run research cache 0x73b8c192bfc323c3ea224c88219d55dfc319e89f --chain base --block 45183966
SFI_RPC_8453=https://mainnet.base.org bun run research cache 0x6Ea8e22AAfDeb8b537b59Fa857E2e49320EC5770 --chain base --block 45183966
SFI_RPC_8453=https://mainnet.base.org bun run research call 0x67b93f6676bd1911c5fae7ffa90fff5f35e14dcd referenceAssetOracle --chain base --block 45183966
```

The drain transaction targets an attacker contract, not the vault. Its unknown selector must not be decoded by trying unrelated vault ABIs. Internal calls, dynamic oracle routing, storage accounting and exploit replay still require separate trace/state analysis; caching sources does not itself establish the drain mechanism.
