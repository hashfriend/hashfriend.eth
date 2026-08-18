# hashfriend.eth

Personal site, published to IPFS and served over ENS at [hashfriend.eth.limo](https://hashfriend.eth.limo).

- [`packages/web`](packages/web) is the Astro site, pages are Markdown/MDX in `src/pages`. 
- [`packages/deploy`](packages/deploy) adds the build to IPFS.

```bash
bun run dev
bun run lint
bun run typecheck

# Build and deploy
bun run build
bun run deploy
```

See [`packages/deploy`](packages/deploy) for what deployment needs and how the IPNS name is kept alive.
