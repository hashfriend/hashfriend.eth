import { $ } from 'bun'

const DEPLOY_DIR = '../web/dist'
const argKey = process.argv.find((arg) => arg.startsWith('--key='))
const IPFS_KEY = argKey ? argKey.split('=')[1] : ''
if (!IPFS_KEY) {
  console.error('❌ IPFS key not provided. Use --key=<key-name> to specify it.')
  process.exit(1)
}

async function main() {
  try {
    console.log('📦 Starting deployment process...\n')
    const cid = await addToIpfs()

    console.log(`🔗 Updating IPNS record with CID ${cid}\n`)
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

async function addToIpfs(): Promise<string> {
  try {
    // Run upload separately and check output for failure
    const uploadResult = await $`pinme upload ${DEPLOY_DIR}`.quiet().nothrow()
    const uploadOutput = uploadResult.stdout.toString() + uploadResult.stderr.toString()
    if (uploadResult.exitCode !== 0 || uploadOutput.includes('Upload failed')) {
      throw new Error(`pinme upload failed: ${uploadOutput}`)
    }

    // Only fetch CID if upload succeeded
    const lsOutput = await $`pinme ls -l 1`.text()

    // Extract CID from the output
    const cidMatch = lsOutput.match(/IPFS CID:\s+([a-z0-9]+)/)
    const cid = cidMatch?.[1]
    if (!cid) throw new Error('Failed to extract CID from upload output')

    console.log(`✅ Successfully added to IPFS with CID: ${cid}\n`)
    return cid
  } catch (error) {
    throw new Error(
      `IPFS upload failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

async function updateIpns(cid: string) {
  try {
    await $`ipfs name publish --ttl=1m /ipfs/${cid} --key=${IPFS_KEY}`
  } catch (error) {
    throw new Error(
      `Deployment step failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
