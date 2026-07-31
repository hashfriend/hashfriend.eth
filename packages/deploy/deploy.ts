import { $ } from 'bun'

const DEPLOY_DIR = '../web/dist'

const SSH_OPTS = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10']

const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? ''

const IPFS_KEY = arg('key')
const PIN_SERVICE = arg('service')

// Kept out of the repo, along with where the remote binary lives when a
// non-interactive ssh shell does not have it on the PATH.
const HOST = process.env.DEPLOY_HOST ?? ''
const REMOTE_IPFS = process.env.DEPLOY_IPFS ?? 'ipfs'

// Delegated routing endpoint the record is handed to and then read back from.
const ROUTER = process.env.DEPLOY_ROUTER || 'https://delegated-ipfs.dev'

if (!IPFS_KEY || !PIN_SERVICE) {
  console.error(
    '❌ Usage: bun deploy.ts --key=<ipns-key> --service=<pin-service>'
  )
  process.exit(1)
}

async function main() {
  try {
    console.log('📦 Starting deployment process...\n')
    await preflight()

    const cid = await addToIpfs()

    console.log(`\n📌 Pinning ${cid} to ${PIN_SERVICE}...`)
    await pinRemote(cid)

    console.log(`\n🔗 Publishing IPNS record for ${cid}`)
    await updateIpns(cid)
    await announceRecord(cid)

    await shipToHost(cid)

    console.log('\n🎉 Deployment completed successfully!')
  } catch (error) {
    console.error(
      '❌ Deployment failed:',
      error instanceof Error ? error.message : String(error)
    )
    process.exit(1)
  }
}

await main()

// Fail before touching the network if anything this deploy leans on is missing.
async function preflight() {
  const services = await $`ipfs pin remote service ls`.text()
  if (
    !services.split('\n').some((line) => line.split(/\s+/)[0] === PIN_SERVICE)
  ) {
    throw new Error(
      `Pinning service '${PIN_SERVICE}' is not configured. Add it with 'ipfs pin remote service add ${PIN_SERVICE} <endpoint> <key>' — see README.`
    )
  }

  const keys = await $`ipfs key list`.text()
  if (!keys.split('\n').includes(IPFS_KEY)) {
    throw new Error(
      `IPFS key '${IPFS_KEY}' not found in the local keystore. Import it with 'ipfs key import ${IPFS_KEY} <file>' — see README.`
    )
  }

  // A daemon with no peers accepts a publish and propagates nothing, so the
  // deploy would report success while the network kept serving the old build.
  const peers = await $`ipfs swarm peers`.nothrow().text()
  if (peers.trim() === '') {
    throw new Error(
      'The local IPFS daemon has no peers, so nothing would propagate. Start it with "ipfs daemon" and give it a moment to bootstrap.'
    )
  }
}

async function addToIpfs(): Promise<string> {
  const cid = (
    await $`ipfs add --recursive --quieter --cid-version=1 ${DEPLOY_DIR}`.text()
  ).trim()

  if (!cid) throw new Error('ipfs add returned no CID')

  console.log(`✅ Added to the local node with CID: ${cid}`)
  return cid
}

// Blocks until the service reports 'pinned', so the content is retrievable
// independently of this machine before IPNS starts pointing at it.
async function pinRemote(cid: string) {
  const result =
    await $`ipfs pin remote add --service=${PIN_SERVICE} --name=${IPFS_KEY} /ipfs/${cid}`
      .quiet()
      .nothrow()

  if (result.exitCode !== 0) {
    const output = result.stderr.toString() + result.stdout.toString()
    // Re-pinning an unchanged build is a no-op, not a failure.
    if (output.includes('already pinned')) return
    throw new Error(`Remote pin failed: ${output.trim()}`)
  }
}

// Long lifetime so the record outlives this machine being asleep, short TTL so
// gateways pick up the next deploy quickly.
async function updateIpns(cid: string) {
  const before = await currentRecord()

  await publish(cid)
  const after = await currentRecord()

  // Two records at the same sequence with different values cannot be ordered by
  // consumers, so gateways serve whichever they saw first. Publishing the old
  // value forces the counter to move, then the real one lands above it.
  if (before && after && before.value !== cid && after.seq <= before.seq) {
    console.log(`⚠️  Sequence stuck at ${after.seq}, bumping it`)
    await publish(before.value)
    await publish(cid)

    const fixed = await currentRecord()
    if (!fixed || fixed.seq <= before.seq) {
      throw new Error(`IPNS sequence will not advance past ${before.seq}`)
    }
    console.log(`✅ Sequence now ${fixed.seq}`)
  }
}

async function publish(cid: string) {
  await $`ipfs name publish --lifetime=8760h --ttl=1m /ipfs/${cid} --key=${IPFS_KEY}`.quiet()
}

// `ipfs name publish` exits zero once the record exists locally, whatever the
// DHT put managed to reach, and every local read agrees with it. Handing the
// record to a router and reading it back from there is the only check that
// speaks for what everyone else can resolve.
async function announceRecord(cid: string) {
  const name = await ipnsName()
  const url = `${ROUTER}/routing/v1/ipns/${name}`

  const put = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/vnd.ipfs.ipns-record' },
    body: await $`ipfs routing get /ipns/${name}`.arrayBuffer()
  })
  if (!put.ok) throw new Error(`${ROUTER} rejected the record: ${put.status}`)

  // The router serves what it accepted about a minute later. Records signed at
  // different moments differ byte for byte, so compare the value they carry.
  for (let waited = 0; waited < 120_000; waited += 5000) {
    const back = await fetch(url, {
      headers: { Accept: 'application/vnd.ipfs.ipns-record' }
    })
    const served = Buffer.from(await back.arrayBuffer())
    const inspected = await $`ipfs name inspect < ${served}`.nothrow().text()

    if (inspected.includes(`/ipfs/${cid}`)) {
      console.log(`✅ Resolvable as /ipns/${name}`)
      return
    }
    await Bun.sleep(5000)
  }

  throw new Error(
    `${ROUTER} does not resolve ${name} to ${cid}, nor would anyone else`
  )
}

async function ipnsName(): Promise<string> {
  const name = (await $`ipfs key list -l`.text())
    .split('\n')
    .find((line) => line.trim().endsWith(` ${IPFS_KEY}`))
    ?.split(/\s+/)[0]

  if (!name) throw new Error(`No IPNS name for key '${IPFS_KEY}'`)
  return name
}

async function currentRecord(): Promise<{ seq: number; value: string } | null> {
  const inspected =
    await $`ipfs routing get /ipns/${await ipnsName()} | ipfs name inspect`
      .nothrow()
      .quiet()
  if (inspected.exitCode !== 0) return null

  const lines = inspected.stdout.toString().split('\n')
  const seq = lines.find((l) => l.startsWith('Sequence:'))?.split(/\s+/)[1]
  const value = lines
    .find((l) => l.startsWith('Value:'))
    ?.match(/\/ipfs\/(\w+)/)?.[1]

  return seq && value ? { seq: Number(seq), value } : null
}

// Streaming the DAG over ssh is faster than leaving the host to find the blocks
// over the p2p network. Allowed to fail: it only serves, it does not publish.
async function shipToHost(cid: string) {
  if (!HOST) {
    console.log('\n⏭️  DEPLOY_HOST is not set, skipping the serving host.')
    return
  }

  console.log(`\n🚚 Shipping ${cid} to ${HOST}...`)

  const shipped =
    await $`ipfs dag export ${cid} | ssh ${SSH_OPTS} ${HOST} ${REMOTE_IPFS} dag import --pin-roots --fast-provide-root`
      .quiet()
      .nothrow()

  if (shipped.exitCode !== 0) {
    console.warn(`⚠️  Could not reach ${HOST}. The deploy stands without it.`)
    return
  }

  console.log(`✅ ${HOST} is serving ${cid}`)
}
