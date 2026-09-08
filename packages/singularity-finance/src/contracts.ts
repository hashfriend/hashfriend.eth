import { mkdir, open } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  type Abi,
  type Address,
  getAddress,
  type Hex,
  keccak256,
  zeroAddress
} from 'viem'
import { type Client, normalize, pinnedBlock } from './rpc'
import { fetchVerifiedSource, type VerifiedSource } from './verified-source'

export const cacheRoot = new URL('../contracts/', import.meta.url).pathname
const implementationSlot =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'
const beaconSlot =
  '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50'

type Artifact = {
  schemaVersion: 1
  chainId: number
  address: Address
  codeHash: Hex
  runtimeBytecode: Hex
  observedBlock: { number: string; hash: Hex; time: string }
  source: Omit<VerifiedSource, 'raw'> | null
}

export type ContractEvidence = {
  address: Address
  codeHash: Hex
  sourceAddress: Address | null
}
export type ResolvedContract = { abi: Abi; evidence: ContractEvidence[] }

export function cloneImplementation(code: Hex): Address | undefined {
  const match = code.match(
    /^0x363d3d373d3d3d363d73([0-9a-f]{40})5af43d82803e903d91602b57fd5bf3$/i
  )
  return match ? getAddress(`0x${match[1]}`) : undefined
}

export function isSafeProxy(code: Hex): boolean {
  // Exact executable prefix; the trailing bytes are Solidity metadata after INVALID.
  return /^0x608060405273ffffffffffffffffffffffffffffffffffffffff600054167fa619486e0000000000000000000000000000000000000000000000000000000060003514156050578060005260206000f35b3660008037600080366000845af43d6000803e60008114156070573d6000fd5b3d6000f3fe[0-9a-f]*$/i.test(
    code
  )
}

export function storageAddress(value?: Hex): Address | undefined {
  if (!value || /^0x0*$/.test(value)) return undefined
  if (!/^0x0{24}[0-9a-f]{40}$/i.test(value))
    throw new Error('Invalid proxy implementation slot')
  const address = getAddress(`0x${value.slice(-40)}`)
  return address === zeroAddress ? undefined : address
}

export function artifactPath(
  root: string,
  chainId: number,
  address: Address,
  hash: Hex
) {
  if (
    !Number.isSafeInteger(chainId) ||
    chainId <= 0 ||
    !/^0x[0-9a-f]{64}$/i.test(hash)
  )
    throw new Error('Invalid cache identity')
  return join(
    root,
    String(chainId),
    getAddress(address).toLowerCase(),
    `${hash.toLowerCase()}.json`
  )
}

export function validateArtifact(
  value: Artifact,
  chainId: number,
  address: Address,
  code: Hex
): Artifact {
  if (
    value.schemaVersion !== 1 ||
    value.chainId !== chainId ||
    getAddress(value.address) !== getAddress(address) ||
    value.runtimeBytecode !== code ||
    value.codeHash !== keccak256(code)
  )
    throw new Error('Contract cache identity or bytecode mismatch')
  if (
    !cloneImplementation(code) &&
    !isSafeProxy(code) &&
    (!value.source ||
      getAddress(value.source.address) !== getAddress(address) ||
      !Array.isArray(value.source.abi) ||
      !Array.isArray(value.source.libraries) ||
      !Number.isFinite(Date.parse(value.source.retrievedAt)) ||
      !Object.values(value.source.sources).some(
        (text) => typeof text === 'string' && text.trim()
      ))
  )
    throw new Error('Contract cache has no address-specific verified source')
  return value
}

async function saveArtifact(path: string, value: Artifact) {
  await mkdir(dirname(path), { recursive: true })
  const file = await open(path, 'wx')
  try {
    await file.writeFile(`${JSON.stringify(normalize(value), null, 2)}\n`)
  } finally {
    await file.close()
  }
}

export class ContractCache {
  private readonly resolved = new Map<string, ResolvedContract>()
  private readonly pending = new Map<string, Promise<ResolvedContract>>()
  private readonly artifacts = new Map<string, Promise<Artifact>>()
  private readonly used = new Map<string, ContractEvidence>()

  constructor(
    readonly client: Client,
    readonly chainId: number,
    readonly blockNumber: bigint,
    readonly root = cacheRoot,
    readonly populate = false,
    readonly imported: VerifiedSource[] = []
  ) {}

  evidence() {
    return [...this.used.values()]
  }

  private async artifact(address: Address): Promise<Artifact> {
    const known = this.artifacts.get(address)
    if (known) return known
    const task = this.loadArtifact(address)
    this.artifacts.set(address, task)
    try {
      return await task
    } catch (error) {
      this.artifacts.delete(address)
      throw error
    }
  }

  private async loadArtifact(address: Address): Promise<Artifact> {
    const code = await this.client.getCode({
      address,
      blockNumber: this.blockNumber
    })
    if (!code || code === '0x')
      throw new Error(
        `No contract code at ${address} in block ${this.blockNumber}`
      )
    const codeHash = keccak256(code)
    const path = artifactPath(this.root, this.chainId, address, codeHash)
    if (await Bun.file(path).exists())
      return validateArtifact(
        await Bun.file(path).json(),
        this.chainId,
        address,
        code
      )
    if (!this.populate)
      throw new Error(
        `Missing verified cache for chain ${this.chainId} ${address} code ${codeHash}; run research cache with this address, --chain and --block ${this.blockNumber}`
      )
    let source: Artifact['source'] = null
    if (!cloneImplementation(code) && !isSafeProxy(code)) {
      const fetched =
        this.imported.find((item) => getAddress(item.address) === address) ??
        (await fetchVerifiedSource(this.chainId, address))
      source = { ...fetched }
      delete (source as Partial<VerifiedSource>).raw
      const latest = await this.client.getCode({ address })
      if (latest !== code)
        throw new Error(
          `Current verified source cannot attest historical bytecode at ${address}; import the matching historical artifact`
        )
    }
    const block = await pinnedBlock(this.client, this.blockNumber)
    const result: Artifact = {
      schemaVersion: 1,
      chainId: this.chainId,
      address,
      codeHash,
      runtimeBytecode: code,
      observedBlock: { ...block, number: block.number.toString() },
      source
    }
    validateArtifact(result, this.chainId, address, code)
    try {
      await saveArtifact(path, result)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      // A concurrent dependency resolution may already have stored this identity.
      return validateArtifact(
        await Bun.file(path).json(),
        this.chainId,
        address,
        code
      )
    }
    console.error(
      `Cached ${this.chainId} ${address}${source ? ` ${source.contractName}` : ' proxy runtime'}`
    )
    return result
  }

  private async implementation(
    artifact: Artifact
  ): Promise<Address | undefined> {
    const clone = cloneImplementation(artifact.runtimeBytecode)
    if (clone) return clone
    const options = { address: artifact.address, blockNumber: this.blockNumber }
    const eip1967 = storageAddress(
      await this.client.getStorageAt({ ...options, slot: implementationSlot })
    )
    if (eip1967) return eip1967
    if (
      isSafeProxy(artifact.runtimeBytecode) ||
      (artifact.source &&
        /^(GnosisSafeProxy|SafeProxy)$/.test(artifact.source.contractName))
    ) {
      const target = storageAddress(
        await this.client.getStorageAt({ ...options, slot: '0x0' })
      )
      if (!target)
        throw new Error(
          `Safe proxy has no implementation at ${artifact.address}`
        )
      return target
    }
    const beacon = storageAddress(
      await this.client.getStorageAt({ ...options, slot: beaconSlot })
    )
    if (beacon || artifact.source?.proxy)
      throw new Error(
        `Unsupported proxy resolution at ${artifact.address}; refusing a guessed ABI`
      )
    return undefined
  }

  async resolve(
    input: Address,
    ancestors: Address[] = []
  ): Promise<ResolvedContract> {
    const address = getAddress(input)
    const known = this.resolved.get(address)
    if (known) return known
    if (ancestors.includes(address) || ancestors.length >= 32)
      throw new Error(`Contract dependency cycle or depth limit at ${address}`)
    // Top-level concurrent reads share resolution; dependencies keep their own cycle checks.
    if (!ancestors.length) {
      const pending = this.pending.get(address)
      if (pending) return pending
      const task = this.resolveArtifact(address, ancestors)
      this.pending.set(address, task)
      try {
        return await task
      } finally {
        this.pending.delete(address)
      }
    }
    return this.resolveArtifact(address, ancestors)
  }

  private async resolveArtifact(
    address: Address,
    ancestors: Address[]
  ): Promise<ResolvedContract> {
    const artifact = await this.artifact(address)
    const evidence: ContractEvidence[] = [
      {
        address,
        codeHash: artifact.codeHash,
        sourceAddress: artifact.source?.address ?? null
      }
    ]
    let abi = artifact.source?.abi ?? []
    const next = [...ancestors, address]
    const implementation = await this.implementation(artifact)
    if (implementation) {
      const target = await this.resolve(implementation, next)
      abi = target.abi
      evidence.push(...target.evidence)
    }
    for (const library of artifact.source?.libraries ?? [])
      evidence.push(...(await this.resolve(library, next)).evidence)
    const result = {
      abi,
      evidence: [
        ...new Map(evidence.map((item) => [item.address, item])).values()
      ]
    }
    this.resolved.set(address, result)
    for (const item of result.evidence) this.used.set(item.address, item)
    return result
  }

  async read<T>(
    address: Address,
    functionName: string,
    args: readonly unknown[] = []
  ): Promise<T> {
    const { abi } = await this.resolve(address)
    return (await this.client.readContract({
      address,
      abi,
      functionName,
      args,
      blockNumber: this.blockNumber
    })) as T
  }
}
