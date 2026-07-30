# @hashfriend/deploy

Publishes `packages/web/dist` to IPFS and points the ENS contenthash at it.

```bash
bun run build     # from the repo root; deploy builds nothing itself
bun run deploy
```

It adds the build, pins the CID to Pinata, publishes the IPNS record, then hands the build to `DEPLOY_HOST` to serve as well. That last step is allowed to fail.

## Setup

Copy `.env.example` to `.env`. You need a running `ipfs daemon`, the `hashfriend.eth` key in its keystore, and the Pinata pinning service:

```bash
ipfs pin remote service add Pinata https://api.pinata.cloud/psa <jwt>
```

`preflight()` checks all of it, including that the daemon has peers, before anything touches the network.

The ENS contenthash is a static `ipns://` pointer derived from the `hashfriend.eth` key. Exactly one machine may hold that key, the one you deploy from. Keep an offline backup of it — losing it means repointing the ENS record by hand.
