import { $ } from 'bun'

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
    const uploadOutput =
      await $`pinme upload ../web/dist && pinme ls -l 1`.text()

    // Extract CID from the output
    const cidMatch = uploadOutput.match(/IPFS CID:\s+([a-z0-9]+)/)
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
    await $`ipfs name publish /ipfs/${cid}`
  } catch (error) {
    throw new Error(
      `Deployment step failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
