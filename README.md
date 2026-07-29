# hashfriend.eth.limo

```bash
bun run dev
bun run build

# needs running `ipfs daemon` and a logged-in pinme (`pinme login`)
bun run deploy
```

`bun run deploy` builds nothing — run `bun run build` first. It pins
`packages/web/dist` via `pinme`, then points the IPNS name at the resulting CID.

The ENS contenthash for hashfriend.eth is a static `ipns://` pointer and never
changes; only the record it resolves to gets republished on each deploy. That
IPNS name is derived from the `hashfriend.eth` key in the local IPFS keystore,
so it must be the same key on every machine that deploys — generating a new one
yields a different name that the ENS record does not point to.

```bash
ipfs key list -l                 # local key name -> IPNS name
ipfs name resolve /ipns/<name>   # what the site currently serves
```

To set up a new machine, export the key from one that has it and import it:

```bash
ipfs key export hashfriend.eth -o hashfriend.eth.key   # on the old machine
ipfs key import hashfriend.eth hashfriend.eth.key      # on the new one
```

Keep the key in exactly one place — two daemons publishing under the same key
can race on IPNS sequence numbers and revert the site to an older CID.
