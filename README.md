# hashfriend.eth.limo

```bash
bun run dev
bun run build

# on first deploy, create dedicated IPFS key to reuse
ipfs key gen hashfriend.eth

# needs running `ipfs daemon`
bun run deploy
```

The hashfriend.eth ENS contenthash entry points to IPNS name:
- `ipns://k51qzi5uqu5dm7u9ns1a5utzqrufm5p8znj2pwl38amnzmwkdmf52ntlg06m8d`