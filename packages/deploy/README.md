# @hashfriend/deploy

Publishes `packages/web/dist` to IPFS and points the ENS contenthash at it.

```bash
bun run build
bun run deploy
```

It adds the build, pins the CID to Pinata, publishes the IPNS record, then hands the build to `DEPLOY_HOST`. That last step is allowed to fail.

`ipfs name publish` reports success once the record exists locally, however few peers its DHT put reached. So the deploy also hands the record to a delegated router and reads it back from there — that read is what decides success. Override with `DEPLOY_ROUTER`.

## Notifying search engines

Once the deploy has reached eth.limo, from this package:

```bash
bun run indexnow <url>...
```

Ownership is proven by `packages/web/public/<key>.txt`, so it must stay in `public/`. Google does not take IndexNow; it only reads the sitemap.

## Setup

Copy `.env.example` to `.env`. You need a running `ipfs daemon`, the `hashfriend.eth` key in its keystore, and the Pinata service:

```bash
ipfs pin remote service add Pinata https://api.pinata.cloud/psa <jwt>
```

The ENS contenthash is a static `ipns://` pointer derived from the `hashfriend.eth` key.
