# @hashfriend/deploy

Publishes `packages/web/dist` to IPFS and points the ENS contenthash at it.

```bash
bun run build     # from the repo root; deploy builds nothing itself
bun run deploy
```

Four steps, in this order:

1. `ipfs add` the build on this machine to get the CID.
2. Stream the DAG to the publishing host over ssh (`dag export` piped into `dag import`), which pins it there. Doing this before the remote pin gives Pinata a second, better connected provider to fetch from.
3. Pin the CID to Pinata, blocking until it reports `pinned`.
4. Publish the IPNS record on the host.

## Setup

Copy `.env.example` to `.env` and set `DEPLOY_HOST` to the ssh host that publishes. It stays out of the repo on purpose.

Locally you need a running `ipfs daemon` and the Pinata pinning service:

```bash
ipfs pin remote service ls
ipfs pin remote service add Pinata https://api.pinata.cloud/psa <jwt>
```

On the host you need passphrase-free ssh, kubo installed at `ipfs` and running under `the service manager` (the package manager is not on the PATH of a non-interactive ssh shell, hence the absolute path), and the `hashfriend.eth` key in its keystore. `preflight()` checks all of it before anything touches the network.

## The IPNS key

The ENS contenthash is a static `ipns://` pointer and never changes, only the record it resolves to gets republished. That name is derived from the `hashfriend.eth` keystore key, and a new key yields a different name the ENS record does not point to.

Exactly one machine may hold that key. Each kubo node keeps its own IPNS sequence counter, so two machines signing the same name produce competing records and consumers get whichever one they happen to reach — a gateway serving a build from two deploys ago is the symptom. It has to be the serving host, because a record that is not republished into the DHT every few hours stops resolving at all.

That host also needs `Ipns.RecordLifetime` set to `8760h`, so its automatic republishes keep the same year-long validity the deploy publishes with:

```bash
ipfs config Ipns.RecordLifetime 8760h   # on the host, then restart the daemon
```

Moving to a new host means moving the key, not copying it. Keep an offline backup of the exported file — losing the key means repointing the ENS record by hand.

```bash
ipfs key export hashfriend.eth -o hashfriend.eth.key   # on the old host
ipfs key import hashfriend.eth hashfriend.eth.key      # on the new one
ipfs key rm hashfriend.eth                             # on the old host
```
