import { $ } from 'bun'

const DEPLOY_DIR = '../web/dist'

const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? ''

const IPFS_KEY = arg('key')
const PIN_SERVICE = arg('service')

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

    console.log(`📌 Pinning ${cid} to ${PIN_SERVICE}...`)
    await pinRemote(cid)

    console.log(`\n🔗 Updating IPNS record with CID ${cid}\n`)
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

// Fail before touching the network if the local daemon is missing either the
// signing key or the pinning service, e.g. on a re-initialized IPFS repo.
async function preflight() {
  const keys = await $`ipfs key list`.text()
  if (!keys.split('\n').includes(IPFS_KEY)) {
    throw new Error(
      `IPFS key '${IPFS_KEY}' not found in the local keystore. Import it with 'ipfs key import ${IPFS_KEY} <file>' — see README.`
    )
  }

  const services = await $`ipfs pin remote service ls`.text()
  if (
    !services.split('\n').some((line) => line.split(/\s+/)[0] === PIN_SERVICE)
  ) {
    throw new Error(
      `Pinning service '${PIN_SERVICE}' is not configured. Add it with 'ipfs pin remote service add ${PIN_SERVICE} <endpoint> <key>' — see README.`
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

async function updateIpns(cid: string) {
  // Long lifetime so the record outlives daemon downtime, short TTL so
  // gateways pick up the next deploy quickly.
  await $`ipfs name publish --lifetime=8760h --ttl=1m /ipfs/${cid} --key=${IPFS_KEY}`
}
