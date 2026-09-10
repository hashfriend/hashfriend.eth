# Singularity Finance research

Read-only viem tooling for the [DynaVault post](https://hashfriend.eth.limo/singularity-finance-exploit/). Start with [NOTEBOOK.md](NOTEBOOK.md) for existing evidence, addresses and unresolved checks. Registry addresses and public RPC defaults live in [src/config.ts](src/config.ts).

## Run

From `packages/singularity-finance`, use `bun run research --help` for the command list.

```bash
bun run research snapshot --chain base --fetch --out evidence/YYYY-MM-DD-base.json
```

`snapshot` requires an explicit chain; `--chain all` selects all six. `--fetch` fills missing source-cache entries. Without it, a cache miss fails. Use `--block NUMBER` with one chain for historical reads. BNB source fetching is not configured, so a complete six-chain snapshot is currently unavailable. Inspect saved JSON directly for changes.

For a known contract, `cache` resolves its implementation and libraries, `call` reads a verified view/pure function, and `gates` probes deposit permissions. The drain-era roots are already cached:

```bash
SFI_RPC_8453=https://mainnet.base.org bun run research cache 0x67b93f6676bd1911c5fae7ffa90fff5f35e14dcd --chain base --block 45183966
SFI_RPC_8453=https://mainnet.base.org bun run research call 0x67b93f6676bd1911c5fae7ffa90fff5f35e14dcd referenceAssetOracle --chain base --block 45183966
```

`tx` saves a transaction, receipt and target-specific decoding. `history` retrieves bounded Base/BNB indexer pages; `block` retrieves full block transactions. `source` archives a raw Base verified-source response. `document` archives a documentation page. Use `--args '[...]'` for function arguments, encoding large integers as strings.

## Output and failures

- JSON goes to stdout or a new `--out` file; diagnostics go to stderr. Existing files are never overwritten. Amounts are decimal strings.
- Name evidence files by the event or pinned-state date, using `START_to_END` for multiple dates. Keep retrieval timestamps inside the records. Reads at earlier blocks are historical onchain reads.
- Exit 1 means a failed command or incomplete snapshot/transaction decoding. Inspect the saved errors before retrying. Older evidence remains unchanged in `evidence/`.
- History always reports `complete: false`, even on exit 0: successful page retrieval never establishes a complete chain scan. `document.retrievedAt` is a retrieval time, not a publication date.
- For RPC failures, override `SFI_RPC_<chainId>` with an archive-capable endpoint. BNB history requires `SFI_3XPL_TOKEN`. Keep credentials out of commands, output and commits. Rate-limited runs can reuse cached contracts on retry; choose a new output filename.
- RPC requests are spaced 250 milliseconds apart across clients in each process. Temporary failures use exponential backoff with up to five retries.

## Verified contract cache

`contracts/<chainId>/<address>/<runtime-code-hash>.json` stores bytecode, block identity, verified ABI, compiler settings, Solidity sources, linked-library addresses and source provenance. The resolver checks runtime code at the requested block and recursively resolves standard EIP-1167 clones, EIP-1967 implementations, supported Safe proxies and libraries. Missing evidence and unsupported proxies fail. Current source is accepted for a historical deployment only when its current and historical runtime match. This trusts the explorer and RPC; it does not reproduce the compiler build.

`cache --source FILE` can import a saved `source` response; repeat the flag for multiple bundles. Raw source responses alone do not establish historical bytecode identity. Snapshot ERC-20 symbol/decimals reads use the standard metadata ABI, not verified token sources.

Transaction decoding uses end-of-block proxy state. Intra-block upgrades and internal calls require separate trace analysis. The drain transaction targets an attacker contract; never decode it with an unrelated vault ABI. Source caching alone does not establish the drain mechanism.

The production filter counts Base registry types 3/4, then symbols starting with `dyn` and excluding `Test` on every chain. Inactive entries remain counted. A sender address does not establish human versus algorithmic trading; zero strategies, guardian authority and oracle roles are separate observations. Asset changes alone do not establish theft or reimbursement.

Keep dated findings in the notebook and editorial rules in [post memory](../../memory/singularity-finance-post.md). Validate tooling changes with `bun test`, `bun run lint` and `bun run typecheck`.
