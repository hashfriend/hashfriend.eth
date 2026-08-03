# hashfriend.eth

Personal site, published to IPFS and served over ENS at [hashfriend.eth.limo](https://hashfriend.eth.limo).

[`packages/web`](packages/web) is the Astro site, pages are Markdown/MDX in `src/pages`. `packages/deploy` adds the build to IPFS.

```bash
bun run dev
bun run build
bun run lint
bun run typecheck
bun run deploy
```

`bun run deploy` builds nothing, so run `bun run build` first. See [`packages/deploy`](packages/deploy) for what it needs and how the IPNS name is kept alive.
