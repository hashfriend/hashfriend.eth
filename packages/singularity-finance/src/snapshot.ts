import {
  type Address,
  erc20Abi,
  formatUnits,
  getContract,
  zeroAddress,
  zeroHash
} from 'viem'
import {
  admin,
  baseOracles,
  type Chain,
  feeSafe,
  governanceSafe,
  isCandidate,
  isProduction,
  oracleAdminRole,
  permittedUserRole,
  probeUser
} from './config'
import { ContractCache, type ContractEvidence } from './contracts'
import {
  assertChain,
  clientFor,
  errorMessage,
  type Json,
  normalize,
  pinnedBlock
} from './rpc'

type TokenStats = {
  tokenIdle: bigint
  tokenDebt: bigint
  depositDebt: bigint
  depositDebtRatio: bigint
  totalProfit: bigint
  totalLoss: bigint
  lastReport: bigint
  lastReportedValue: bigint
  watermark: bigint
  watermarkDuration: bigint
  lastWatermark: bigint
}

type FeeStorage = {
  managementFee: bigint
  performanceFee: bigint
  depositFee: bigint
  redemptionFee: bigint
  managementFeeWallet: Address
  performanceFeeWallet: Address
  depositFeeWallet: Address
  redemptionFeeWallet: Address
}

export type VaultRecord = {
  vault: Address
  vaultType: number
  active: boolean
}

export async function readGates(cache: ContractCache, address: Address) {
  const [permissionDisabled, maxDeposit, permitted] = await Promise.all([
    cache.read<boolean>(address, 'permissionDisabled'),
    cache.read<bigint>(address, 'maxDeposit', [probeUser]),
    cache.read<boolean>(address, 'hasRole', [permittedUserRole, probeUser])
  ])
  return {
    permissionDisabled,
    probe: { address: probeUser, maxDeposit, permitted }
  }
}

export async function readVault(
  cache: ContractCache,
  address: Address,
  symbol: string
) {
  const manager = await cache.read<Address>(address, 'manager')
  const [
    gov,
    guardian,
    management,
    tokens,
    stats,
    assets,
    supply,
    oracle,
    asset,
    shareDecimals,
    emergency,
    fees,
    gates
  ] = await Promise.all([
    cache.read<Address>(manager, 'governance'),
    cache.read<Address>(manager, 'guardian'),
    cache.read<Address>(manager, 'management'),
    cache.read<Address[]>(manager, 'allTokens'),
    cache.read<TokenStats[]>(manager, 'allTokenStats'),
    cache.read<bigint>(address, 'totalAssets'),
    cache.read<bigint>(address, 'totalSupply'),
    cache.read<Address>(address, 'referenceAssetOracle'),
    cache.read<Address>(address, 'asset'),
    cache.read<number>(address, 'decimals'),
    cache.read<boolean>(manager, 'isEmergencyShutdown'),
    cache.read<FeeStorage>(manager, 'getFees'),
    readGates(cache, address)
  ])
  if (tokens.length !== stats.length)
    throw new Error(`${address}: token/stat count mismatch`)
  const token = getContract({
    address: asset,
    abi: erc20Abi,
    client: cache.client
  })
  const options = { blockNumber: cache.blockNumber }
  const [assetSymbol, assetDecimals, strategies] = await Promise.all([
    token.read.symbol(options),
    token.read.decimals(options),
    Promise.all(
      tokens.map((item) =>
        cache.read<Address[]>(manager, 'getTokenStrategies', [item])
      )
    )
  ])
  return normalize({
    address,
    symbol,
    manager,
    gov,
    guardian,
    management,
    emergency,
    fees,
    oracle,
    ...gates,
    asset,
    assetSymbol,
    assetDecimals,
    shareDecimals,
    assets,
    supply,
    formattedAssets: formatUnits(assets, assetDecimals),
    formattedSupply: formatUnits(supply, shareDecimals),
    tokens: tokens.map((item, index) => ({
      address: item,
      ...stats[index],
      strategies: strategies[index].filter(
        (strategy) => strategy !== zeroAddress
      )
    }))
  })
}

async function readSafe(cache: ContractCache, address: Address) {
  const [threshold, owners, nonce] = await Promise.all([
    cache.read<bigint>(address, 'getThreshold'),
    cache.read<Address[]>(address, 'getOwners'),
    cache.read<bigint>(address, 'nonce')
  ])
  return normalize({ address, threshold, owners, nonce })
}

async function readOracle(cache: ContractCache, address: Address) {
  const holders = await Promise.all(
    ([admin, governanceSafe] as const).map(async (account) => ({
      account,
      defaultAdmin: await cache.read<boolean>(address, 'hasRole', [
        zeroHash,
        account
      ]),
      oracleAdmin: await cache.read<boolean>(address, 'hasRole', [
        oracleAdminRole,
        account
      ])
    }))
  )
  return normalize({ address, holders })
}

export type ChainSnapshot = {
  chain: string
  chainId: number
  complete: boolean
  block: Json
  registry: Address
  entries: Json
  excluded: Json[]
  vaults: Json[]
  safes: Json[]
  oracles: Json[]
  abiEvidence: ContractEvidence[]
  errors: { target: string; message: string }[]
}

export type Snapshot = {
  schemaVersion: 2
  capturedAt: string
  abiPolicy: 'verified-address-cache-v1'
  chains: ChainSnapshot[]
}

export async function snapshotChain(
  chain: Chain,
  blockNumber?: bigint,
  populate = false
): Promise<ChainSnapshot> {
  const client = clientFor(chain)
  const result: ChainSnapshot = {
    chain: chain.name,
    chainId: chain.id,
    complete: false,
    block: null,
    registry: chain.registry,
    entries: null,
    excluded: [],
    vaults: [],
    safes: [],
    oracles: [],
    abiEvidence: [],
    errors: []
  }
  const capture = async (target: string, read: () => Promise<void>) => {
    try {
      await read()
    } catch (error) {
      result.errors.push({ target, message: errorMessage(error) })
    }
  }
  await capture('registry', async () => {
    await assertChain(client, chain.id)
    const block = await pinnedBlock(client, blockNumber)
    result.block = normalize(block)
    const cache = new ContractCache(
      client,
      chain.id,
      block.number,
      undefined,
      populate
    )
    const entries = await cache.read<VaultRecord[]>(
      result.registry,
      'allVaults'
    )
    result.entries = normalize(entries)
    for (const entry of entries) {
      if (!isCandidate(chain.id, entry.vaultType)) {
        result.excluded.push({
          address: entry.vault,
          reason: 'Base registry type outside 3/4'
        })
        continue
      }
      await capture(entry.vault, async () => {
        const symbol = await cache.read<string>(entry.vault, 'symbol')
        if (!isProduction(symbol)) {
          result.excluded.push({
            address: entry.vault,
            symbol,
            reason: 'Non-production symbol'
          })
          return
        }
        result.vaults.push(await readVault(cache, entry.vault, symbol))
      })
    }
    if ([56, 8453].includes(chain.id)) {
      for (const address of [governanceSafe, feeSafe] as const)
        await capture(address, async () => {
          result.safes.push(await readSafe(cache, address))
        })
    }
    if (chain.id === 8453) {
      for (const address of baseOracles)
        await capture(address, async () => {
          result.oracles.push(await readOracle(cache, address))
        })
    }
    result.abiEvidence = cache.evidence()
    const confirmed = await pinnedBlock(client, block.number)
    if (confirmed.hash !== block.hash)
      throw new Error(
        'Pinned block changed during reads; discard this snapshot'
      )
  })
  result.complete = result.errors.length === 0
  return result
}

export async function snapshot(
  selected: readonly Chain[],
  blockNumber?: bigint,
  populate = false
): Promise<Snapshot> {
  const results: ChainSnapshot[] = []
  for (const chain of selected) {
    console.error(`Reading ${chain.name}…`)
    results.push(await snapshotChain(chain, blockNumber, populate))
  }
  return {
    schemaVersion: 2,
    capturedAt: new Date().toISOString(),
    abiPolicy: 'verified-address-cache-v1',
    chains: results
  }
}
