# hashfriend.eth.limo

```bash
bun run dev
bun run build

# needs running `ipfs daemon`
bun run deploy
```

`bun run deploy` builds nothing — run `bun run build` first. It pins
`packages/web/dist` via `pinme`, then points the IPNS name at the resulting CID.

The hashfriend.eth ENS contenthash entry points to IPNS name:
- `ipns://k51qzi5uqu5dm7u9ns1a5utzqrufm5p8znj2pwl38amnzmwkdmf52ntlg06m8d`

That name is derived from the `hashfriend.eth` key in the local IPFS keystore.
It must be the same key on every machine that deploys — generating a new one
yields a different IPNS name that the ENS record does not point to.

```bash
ipfs key list -l   # k51qzi5uqu5dm7u9ns1a5utzqrufm5p8znj2pwl38amnzmwkdmf52ntlg06m8d hashfriend.eth
```

To set up a new machine, export the key from one that has it and import it:

```bash
ipfs key export hashfriend.eth -o hashfriend.eth.key   # on the old machine
ipfs key import hashfriend.eth hashfriend.eth.key      # on the new one
```

Keep the key in exactly one place — two daemons publishing under the same key
can race on IPNS sequence numbers and revert the site to an older CID.
