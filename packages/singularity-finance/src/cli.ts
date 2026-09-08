import { mkdir, open } from 'node:fs/promises'
import { dirname } from 'node:path'
import { parseArgs } from 'node:util'
import { getAddress, type Hex, toFunctionSelector } from 'viem'
import { chains, getChain } from './config'
import { ContractCache } from './contracts'
import { baseHistory, bnbHistory, documentSource } from './explorers'
import {
  assertChain,
  clientFor,
  errorMessage,
  normalize,
  pinnedBlock
} from './rpc'
import { readGates, snapshot } from './snapshot'
import { transaction } from './transactions'
import {
  fetchVerifiedSource,
  parseVerifiedSource,
  type VerifiedSource,
  verifiedSourceUrl
} from './verified-source'

const usage = `Read-only DynaVault research. Run from packages/singularity-finance:

  bun run research snapshot --chain base|all [--fetch] [--block NUMBER] [--out FILE]
  bun run research cache ADDRESS --chain base [--block NUMBER] [--source FILE ...] [--out FILE]
  bun run research gates ADDRESS --chain bnb [--block NUMBER] [--out FILE]
  bun run research tx HASH --chain bnb [--out FILE]
  bun run research block --chain bnb --block NUMBER [--out FILE]
  bun run research call ADDRESS FUNCTION_NAME --chain base [--args JSON] [--block NUMBER] [--out FILE]
  bun run research history ADDRESS --chain base|bnb [--pages 1] [--direction to|from] [--out FILE]
  bun run research source ADDRESS [--out FILE]     Base verified contract sources
  bun run research document URL [--out FILE]      Preserve a documentation page
  bun run research selector 'setPermissionDisabled(bool)'

Chains: ethereum, optimism, arbitrum, bnb, polygon, base. Only snapshot accepts all.
--fetch caches missing verified sources. Otherwise reads require existing artifacts.
BNB source fetching is unavailable; snapshots there require a populated cache.
JSON goes to stdout or a new --out file. Existing files are never overwritten.
--block requires --chain. Incomplete snapshots are saved and exit 1.
History is bounded indexer evidence, never a complete chain scan.
Use SFI_RPC_<chainId> for RPC overrides and SFI_3XPL_TOKEN for BNB history.
See README.md for the investigation workflow. -h, --help prints this help.`

const allowed: Record<string, string[]> = {
  snapshot: ['chain', 'block', 'fetch'],
  cache: ['chain', 'block', 'source'],
  gates: ['chain', 'block'],
  tx: ['chain'],
  block: ['chain', 'block'],
  call: ['chain', 'block', 'args'],
  history: ['chain', 'pages', 'direction'],
  source: [],
  document: [],
  selector: []
}

export function blockArgument(value?: string) {
  if (value === undefined) return undefined
  if (!/^\d+$/.test(value))
    throw new Error('--block must be a non-negative integer')
  return BigInt(value)
}

export async function writeResult(value: unknown, path?: string) {
  const text = `${errorMessage(JSON.stringify(normalize(value), null, 2))}\n`
  if (!path) {
    console.log(text.trimEnd())
    return
  }
  await mkdir(dirname(path), { recursive: true })
  const handle = await open(path, 'wx')
  try {
    await handle.writeFile(text)
  } finally {
    await handle.close()
  }
  console.error(`Saved ${path}`)
}

export async function main(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      out: { type: 'string', short: 'o' },
      chain: { type: 'string' },
      block: { type: 'string' },
      pages: { type: 'string' },
      direction: { type: 'string' },
      args: { type: 'string' },
      source: { type: 'string', multiple: true },
      fetch: { type: 'boolean' }
    }
  })
  if (values.help || positionals.length === 0) {
    console.log(usage)
    return
  }
  const [command, ...inputs] = positionals
  if (!Object.hasOwn(allowed, command))
    throw new Error(`Unknown command ${command}; use --help`)
  for (const option of Object.keys(values))
    if (!['out', ...allowed[command]].includes(option))
      throw new Error(`--${option} is not valid for ${command}`)
  const count = ['snapshot', 'block'].includes(command)
    ? 0
    : command === 'call'
      ? 2
      : 1
  if (inputs.length !== count)
    throw new Error(
      `${command} requires ${count} positional arguments; use --help`
    )
  if (
    ['snapshot', 'gates', 'tx', 'history', 'block', 'call', 'cache'].includes(
      command
    ) &&
    !values.chain
  )
    throw new Error(`${command} requires --chain`)
  if (values.block && !values.chain) throw new Error('--block requires --chain')
  if (
    values.chain === 'all' &&
    (command !== 'snapshot' || values.block !== undefined)
  )
    throw new Error('--chain all is only valid for snapshot without --block')
  const chain =
    values.chain && values.chain !== 'all' ? getChain(values.chain) : undefined
  const blockNumber = blockArgument(values.block)
  if (values.out && (await Bun.file(values.out).exists()))
    throw new Error(
      `Output already exists: ${values.out}; choose a new --out file`
    )
  let result: unknown
  switch (command) {
    case 'snapshot': {
      const data = await snapshot(
        chain ? [chain] : chains,
        blockNumber,
        values.fetch ?? false
      )
      result = data
      if (data.chains.some((item) => !item.complete)) process.exitCode = 1
      break
    }
    case 'gates':
    case 'call':
    case 'cache': {
      if (!chain) throw new Error('Missing chain')
      const address = getAddress(inputs[0])
      const args: unknown = JSON.parse(values.args ?? '[]')
      if (!Array.isArray(args))
        throw new Error(
          '--args must be a JSON array; encode large integers as strings'
        )
      const client = clientFor(chain)
      await assertChain(client, chain.id)
      const block = await pinnedBlock(client, blockNumber)
      const imported: VerifiedSource[] = []
      for (const path of values.source ?? []) {
        const bundle = await Bun.file(path).json()
        if (bundle.chain !== chain.name)
          throw new Error('Imported source chain mismatch')
        const address = getAddress(bundle.address)
        const parsed = parseVerifiedSource(
          address,
          verifiedSourceUrl(chain.id, address),
          bundle.response
        )
        if (
          typeof bundle.retrievedAt !== 'string' ||
          !Number.isFinite(Date.parse(bundle.retrievedAt))
        )
          throw new Error('Imported source lacks retrieval time')
        imported.push({
          ...parsed,
          provider: 'blockscout-import',
          retrievedAt: bundle.retrievedAt
        })
      }
      const cache = new ContractCache(
        client,
        chain.id,
        block.number,
        undefined,
        command === 'cache',
        imported
      )
      let details: Record<string, unknown> = {}
      if (command === 'cache') await cache.resolve(address)
      else if (command === 'gates') details = await readGates(cache, address)
      else {
        const { abi } = await cache.resolve(address)
        if (
          !abi.some(
            (entry) =>
              entry.type === 'function' &&
              entry.name === inputs[1] &&
              ['view', 'pure'].includes(entry.stateMutability)
          )
        )
          throw new Error(
            'call requires a view or pure function in the verified ABI'
          )
        details = {
          functionName: inputs[1],
          args,
          result: await cache.read(address, inputs[1], args)
        }
      }
      if ((await pinnedBlock(client, block.number)).hash !== block.hash)
        throw new Error('Block changed during contract read')
      result = {
        chain: chain.name,
        block,
        address,
        ...details,
        abiEvidence: cache.evidence()
      }
      break
    }
    case 'tx': {
      if (!chain) throw new Error('Missing chain')
      const data = await transaction(chain, inputs[0] as Hex)
      result = data
      if (!data.complete) process.exitCode = 1
      break
    }
    case 'block': {
      if (!chain || blockNumber === undefined)
        throw new Error('block requires --chain and --block')
      const client = clientFor(chain)
      await assertChain(client, chain.id)
      result = {
        chain: chain.name,
        block: await client.getBlock({ blockNumber, includeTransactions: true })
      }
      break
    }
    case 'history': {
      const direction = values.direction ?? 'to'
      if (!['to', 'from'].includes(direction))
        throw new Error('--direction must be to or from')
      const pages = Number(values.pages ?? '1')
      if (chain?.name === 'base')
        result = await baseHistory(inputs[0], pages, direction as 'to' | 'from')
      else if (chain?.name === 'bnb' && !values.direction)
        result = await bnbHistory(inputs[0], pages)
      else
        throw new Error(
          'History supports Base or BNB; --direction applies only to Base'
        )
      result = {
        chain: chain.name,
        address: getAddress(inputs[0]),
        retrievedAt: new Date().toISOString(),
        ...(result as object)
      }
      break
    }
    case 'source':
      result = {
        chain: 'base',
        address: getAddress(inputs[0]),
        retrievedAt: new Date().toISOString(),
        response: (await fetchVerifiedSource(8453, getAddress(inputs[0]))).raw
      }
      break
    case 'document':
      result = await documentSource(inputs[0])
      break
    case 'selector':
      result = { signature: inputs[0], selector: toFunctionSelector(inputs[0]) }
      break
  }
  await writeResult(result, values.out)
}

if (import.meta.main) {
  main(Bun.argv.slice(2)).catch((error) => {
    console.error(errorMessage(error))
    process.exitCode = 1
  })
}
