# hashfriend.eth

Personal site, published to IPFS and served over ENS at [hashfriend.eth.limo](https://hashfriend.eth.limo).

`packages/web` is the Astro site, pages are Markdown/MDX in `src/pages`. `packages/deploy` adds the build to a local IPFS node, pins it to Pinata, then republishes the IPNS record.

```bash
bun run dev
bun run build
bun run lint
bun run typecheck
bun run deploy
```

`bun run deploy` builds nothing, so run `bun run build` first. It needs a running `ipfs daemon` with the `hashfriend.eth` key in the keystore and a `Pinata` remote pinning service configured. The script checks both before touching the network.

```bash
ipfs key list -l
ipfs pin remote service ls
ipfs pin remote service add Pinata https://api.pinata.cloud/psa <jwt>
```

## The IPNS key

The ENS contenthash is a static `ipns://` pointer and never changes, only the record it resolves to gets republished. That name is derived from the `hashfriend.eth` keystore key, so every machine that deploys needs the same key. A new key yields a different name that the ENS record does not point to.

```bash
ipfs key export hashfriend.eth -o hashfriend.eth.key   # on the old machine
ipfs key import hashfriend.eth hashfriend.eth.key      # on the new one
```
