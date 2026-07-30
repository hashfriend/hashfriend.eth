import { $ } from 'bun'

const DEPLOY_DIR = '../web/dist'

// the package manager is not on the PATH of a non-interactive ssh shell on macOS, so the
// remote binary is addressed absolutely.
const REMOTE_IPFS = 'ipfs'
const SSH_OPTS = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10']

const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? ''

const IPFS_KEY = arg('key')
const PIN_SERVICE = arg('service')

// Kept out of the repo: the publishing host is private infrastructure.
const HOST = process.env.DEPLOY_HOST ?? ''

if (!IPFS_KEY || !PIN_SERVICE) {
  console.error(
    '❌ Usage: bun deploy.ts --key=<ipns-key> --service=<pin-service>'
  )
  process.exit(1)
}

if (!HOST) {
  console.error(
    '❌ DEPLOY_HOST is not set. Put it in packages/deploy/.env — see README.'
  )
  process.exit(1)
}

async function main() {
  try {
    console.log('📦 Starting deployment process...\n')
    await preflight()

    const cid = await addToIpfs()

    console.log(`🚚 Shipping ${cid} to ${HOST}...`)
    await shipToHost(cid)

    console.log(`\n📌 Pinning ${cid} to ${PIN_SERVICE}...`)
    await pinRemote(cid)

    console.log(`\n🔗 Updating IPNS record on ${HOST} with CID ${cid}\n`)
    await updateIpns(cid)

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

// Fail before touching the network if anything this deploy leans on is missing:
// the local pinning service, or the host that ends up serving and signing.
async function preflight() {
  const services = await $`ipfs pin remote service ls`.text()
  if (
    !services.split('\n').some((line) => line.split(/\s+/)[0] === PIN_SERVICE)
  ) {
    throw new Error(
      `Pinning service '${PIN_SERVICE}' is not configured. Add it with 'ipfs pin remote service add ${PIN_SERVICE} <endpoint> <key>' — see README.`
    )
  }

  const binary = await $`ssh ${SSH_OPTS} ${HOST} test -x ${REMOTE_IPFS}`
    .quiet()
    .nothrow()
  if (binary.exitCode !== 0) {
    throw new Error(
      `Cannot reach '${REMOTE_IPFS}' on ${HOST} over ssh. Check the host is up, that key-based ssh works, and that kubo is installed there — see README.`
    )
  }

  // Most ipfs subcommands happily run against a stopped repo, but publishing
  // needs a daemon and serving needs peers, so require both up front.
  const peers = await $`ssh ${SSH_OPTS} ${HOST} ${REMOTE_IPFS} swarm peers`
    .quiet()
    .nothrow()
  if (peers.exitCode !== 0) {
    throw new Error(
      `The IPFS daemon on ${HOST} is not running. Start it with 'the ipfs daemon' there — see README.`
    )
  }

  // Only the host holds the signing key. A second keystore with the same key
  // would fork the IPNS sequence counter and the two records would clobber
  // each other, which is how this deploy used to break.
  const keys = await $`ssh ${SSH_OPTS} ${HOST} ${REMOTE_IPFS} key list`.text()
  if (!keys.split('\n').includes(IPFS_KEY)) {
    throw new Error(
      `IPFS key '${IPFS_KEY}' not found in the keystore on ${HOST}. Import it there with 'ipfs key import ${IPFS_KEY} <file>' — see README.`
    )
  }
}

async function addToIpfs(): Promise<string> {
  const cid = (
    await $`ipfs add --recursive --quieter --cid-version=1 ${DEPLOY_DIR}`.text()
  ).trim()

  if (!cid) throw new Error('ipfs add returned no CID')

  console.log(`✅ Added to the local node with CID: ${cid}\n`)
  return cid
}

// Streaming the DAG over ssh keeps the transfer exact and at LAN speed rather
// than leaving the host to discover the blocks over the p2p network. Runs
// before the remote pin so the pinning service has two providers to fetch
// from, the better connected of which is the host.
async function shipToHost(cid: string) {
  await $`ipfs dag export ${cid} | ssh ${SSH_OPTS} ${HOST} ${REMOTE_IPFS} dag import --pin-roots --fast-provide-root`
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

// Long lifetime so the record outlives daemon downtime, short TTL so gateways
// pick up the next deploy quickly. Published on the host because it is the only
// machine with the key, and the only one awake often enough to keep the record
// alive in the DHT.
async function updateIpns(cid: string) {
  await $`ssh ${SSH_OPTS} ${HOST} ${REMOTE_IPFS} name publish --lifetime=8760h --ttl=1m /ipfs/${cid} --key=${IPFS_KEY}`
}
