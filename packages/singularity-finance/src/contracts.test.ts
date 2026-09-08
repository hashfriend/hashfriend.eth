import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { type Address, getAddress, type Hex, keccak256 } from 'viem'
import {
  artifactPath,
  ContractCache,
  type ContractEvidence,
  validateArtifact
} from './contracts'
import type { Client } from './rpc'
import type { VerifiedSource } from './verified-source'

const chainId = 8453
const blockNumber = 100n
const blockHash = `0x${'ab'.repeat(32)}` as Hex
const implementation = '0x0000000000000000000000000000000000000002' as Address
const proxy = '0x0000000000000000000000000000000000000003' as Address
const library = '0x0000000000000000000000000000000000000004' as Address
const mismatched = '0x0000000000000000000000000000000000000005' as Address
const clone = '0x0000000000000000000000000000000000000006' as Address
const drainedVault = '0x67b93f6676bd1911c5fae7ffa90fff5f35e14dcd' as Address
const drainedManager = '0x478675aa4121c07825167bbb25a44aadd22bef7f' as Address

const implementationSlot =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'

type ClientState = {
  codes: Map<string, Hex>
  storage: Map<string, Hex>
  readContractCalls: number
}

function key(address: Address) {
  return address.toLowerCase()
}

function storageKey(address: Address, slot: Hex) {
  return `${key(address)}:${slot}`
}

function client(state: ClientState): Client {
  return {
    getCode: async ({ address }: { address: Address }) =>
      state.codes.get(key(address)) ?? '0x',
    getStorageAt: async ({ address, slot }: { address: Address; slot: Hex }) =>
      state.storage.get(storageKey(address, slot)) ?? `0x${'00'.repeat(32)}`,
    getBlock: async () => ({
      number: blockNumber,
      hash: blockHash,
      timestamp: 1_000n
    }),
    readContract: async () => {
      state.readContractCalls += 1
      return true
    }
  } as unknown as Client
}

function source(
  address: Address,
  libraries: Address[] = [],
  proxy = false
): VerifiedSource {
  return {
    provider: 'fixture',
    url: 'https://fixture.invalid/source',
    address,
    contractName: proxy ? 'SafeProxy' : 'Fixture',
    abi: [
      {
        type: 'function',
        name: 'value',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint256' }]
      }
    ],
    sources: {
      'Fixture.sol':
        'contract Fixture { function value() external view returns (uint256) {} }'
    },
    compiler: { version: 'fixture' },
    libraries,
    raw: { fixture: true },
    proxy,
    retrievedAt: '2026-09-08T00:00:00Z'
  }
}

async function writeArtifact(
  root: string,
  address: Address,
  code: Hex,
  artifactAddress = address,
  artifactSource: ReturnType<typeof source> | null = source(address)
) {
  const path = artifactPath(root, chainId, address, keccak256(code))
  await mkdir(dirname(path), { recursive: true })
  await Bun.write(
    path,
    JSON.stringify({
      schemaVersion: 1,
      chainId,
      address: artifactAddress,
      codeHash: keccak256(code),
      runtimeBytecode: code,
      observedBlock: {
        number: blockNumber.toString(),
        hash: blockHash,
        time: '1970-01-01T00:16:40.000Z'
      },
      source: artifactSource ? { ...artifactSource, raw: undefined } : null
    })
  )
}

async function fixtureRoot() {
  return await mkdtemp(join(tmpdir(), 'sfi-contract-cache-'))
}

function state(entries: [Address, Hex][]) {
  return {
    codes: new Map(entries.map(([address, code]) => [key(address), code])),
    storage: new Map<string, Hex>(),
    readContractCalls: 0
  }
}

async function realArtifacts() {
  const root = join(import.meta.dir, '..', 'contracts')
  const files = new Bun.Glob('8453/*/*.json').scan({
    cwd: root,
    absolute: true
  })
  const artifacts = new Map<
    string,
    { code: Hex; value: Record<string, unknown> }
  >()
  for await (const file of files) {
    const value = (await Bun.file(file).json()) as Record<string, unknown>
    const address = getAddress(String(value.address))
    const code = String(value.runtimeBytecode) as Hex
    artifacts.set(key(address), { code, value })
  }
  return { root, artifacts }
}

describe('ContractCache', () => {
  test('missing cache fails before readContract', async () => {
    const root = await fixtureRoot()
    try {
      const current = `0x6001` as Hex
      const stateValue = state([[implementation, current]])
      const cache = new ContractCache(
        client(stateValue),
        chainId,
        blockNumber,
        root
      )
      await expect(cache.read(implementation, 'value')).rejects.toThrow(
        'Missing verified cache'
      )
      expect(stateValue.readContractCalls).toBe(0)
    } finally {
      await rm(root, { recursive: true })
    }
  })

  test('clone resolves its cached implementation', async () => {
    const root = await fixtureRoot()
    try {
      const implementationCode = `0x6001` as Hex
      const cloneCode =
        `0x363d3d373d3d3d363d73${implementation.slice(2)}5af43d82803e903d91602b57fd5bf3` as Hex
      const stateValue = state([
        [clone, cloneCode],
        [implementation, implementationCode]
      ])
      await writeArtifact(root, clone, cloneCode, clone, null)
      await writeArtifact(root, implementation, implementationCode)
      const result = await new ContractCache(
        client(stateValue),
        chainId,
        blockNumber,
        root
      ).resolve(clone)
      expect(result.abi).toHaveLength(1)
      expect(result.evidence).toEqual([
        {
          address: clone,
          codeHash: keccak256(cloneCode),
          sourceAddress: null
        },
        {
          address: implementation,
          codeHash: keccak256(implementationCode),
          sourceAddress: implementation
        }
      ] satisfies ContractEvidence[])
    } finally {
      await rm(root, { recursive: true })
    }
  })

  test('missing linked library fails resolution', async () => {
    const root = await fixtureRoot()
    try {
      const code = `0x6001` as Hex
      const stateValue = state([
        [implementation, code],
        [library, code]
      ])
      await writeArtifact(
        root,
        implementation,
        code,
        implementation,
        source(implementation, [library])
      )
      await expect(
        new ContractCache(
          client(stateValue),
          chainId,
          blockNumber,
          root
        ).resolve(implementation)
      ).rejects.toThrow('Missing verified cache')
    } finally {
      await rm(root, { recursive: true })
    }
  })

  test('changed runtime fails cache lookup', async () => {
    const root = await fixtureRoot()
    try {
      const cached = `0x6001` as Hex
      const current = `0x6002` as Hex
      const stateValue = state([[implementation, current]])
      await writeArtifact(root, implementation, cached)
      await expect(
        new ContractCache(
          client(stateValue),
          chainId,
          blockNumber,
          root
        ).resolve(implementation)
      ).rejects.toThrow('Missing verified cache')
    } finally {
      await rm(root, { recursive: true })
    }
  })

  test('EIP1967 target without a matching cache is rejected', async () => {
    const root = await fixtureRoot()
    try {
      const proxyCode = `0x6001` as Hex
      const stateValue = state([
        [proxy, proxyCode],
        [implementation, `0x6002`]
      ])
      stateValue.storage.set(
        storageKey(proxy, implementationSlot as Hex),
        `0x${'00'.repeat(12)}${implementation.slice(2)}`
      )
      await writeArtifact(
        root,
        proxy,
        proxyCode,
        proxy,
        source(proxy, [], true)
      )
      await expect(
        new ContractCache(
          client(stateValue),
          chainId,
          blockNumber,
          root
        ).resolve(proxy)
      ).rejects.toThrow('Missing verified cache')
    } finally {
      await rm(root, { recursive: true })
    }
  })

  test('identity mismatch is rejected', async () => {
    const root = await fixtureRoot()
    try {
      const code = `0x6001` as Hex
      const stateValue = state([[implementation, code]])
      await writeArtifact(root, implementation, code, mismatched)
      await expect(
        new ContractCache(
          client(stateValue),
          chainId,
          blockNumber,
          root
        ).resolve(implementation)
      ).rejects.toThrow('identity or bytecode mismatch')
    } finally {
      await rm(root, { recursive: true })
    }
  })

  test('concurrent resolution of one address succeeds', async () => {
    const root = await fixtureRoot()
    try {
      const code = `0x6001` as Hex
      const stateValue = state([[implementation, code]])
      await writeArtifact(root, implementation, code)
      const cache = new ContractCache(
        client(stateValue),
        chainId,
        blockNumber,
        root
      )
      const [first, second] = await Promise.all([
        cache.resolve(implementation),
        cache.resolve(implementation)
      ])
      expect(first).toEqual(second)
      expect(cache.evidence()).toHaveLength(1)
    } finally {
      await rm(root, { recursive: true })
    }
  })

  test('resolves the persisted historical drain cache', async () => {
    const { root, artifacts } = await realArtifacts()
    const stateValue = state(
      [...artifacts].map(([address, artifact]) => [
        address as Address,
        artifact.code
      ])
    )
    const cache = new ContractCache(
      client(stateValue),
      chainId,
      blockNumber,
      root
    )
    for (const artifact of artifacts.values()) {
      expect(() =>
        validateArtifact(
          artifact.value as never,
          chainId,
          getAddress(String(artifact.value.address)),
          artifact.code
        )
      ).not.toThrow()
    }
    const vault = await cache.resolve(drainedVault)
    const manager = await cache.resolve(drainedManager)
    expect(vault.evidence).toHaveLength(5)
    expect(manager.evidence).toHaveLength(9)
    expect(vault.abi.filter((item) => item.type === 'function')).toHaveLength(
      77
    )
    expect(manager.abi.filter((item) => item.type === 'function')).toHaveLength(
      93
    )
  })

  test('Safe runtime resolves slot zero without explorer proxy labels', async () => {
    const root = await fixtureRoot()
    try {
      const { artifacts } = await realArtifacts()
      const safe = artifacts.get('0x5bfc34fba904b7d93a13c381adcc47de657599ff')
      if (!safe) throw new Error('Missing persisted Safe runtime fixture')
      const stateValue = state([
        [proxy, safe.code],
        [implementation, '0x6001']
      ])
      stateValue.storage.set(
        storageKey(proxy, '0x0'),
        `0x${implementation.slice(2).padStart(64, '0')}`
      )
      await writeArtifact(root, proxy, safe.code, proxy, null)
      await writeArtifact(root, implementation, '0x6001')
      const resolved = await new ContractCache(
        client(stateValue),
        chainId,
        blockNumber,
        root
      ).resolve(proxy)
      expect(resolved.evidence).toHaveLength(2)
      expect(resolved.evidence[0].sourceAddress).toBeNull()
      expect(resolved.abi[0]).toMatchObject({ type: 'function', name: 'value' })
    } finally {
      await rm(root, { recursive: true })
    }
  })

  test('populate rejects current source for changed historical bytecode', async () => {
    const root = await fixtureRoot()
    try {
      const historical = `0x6001` as Hex
      const current = `0x6002` as Hex
      const stateValue = state([[implementation, historical]])
      const originalGetCode = stateValue.codes.get(key(implementation))
      const historicalClient = client(stateValue)
      historicalClient.getCode = async ({
        blockNumber
      }: {
        blockNumber?: bigint
      }) => (blockNumber === undefined ? current : (originalGetCode ?? '0x'))
      await expect(
        new ContractCache(historicalClient, chainId, blockNumber, root, true, [
          source(implementation)
        ]).resolve(implementation)
      ).rejects.toThrow('cannot attest historical bytecode')
      expect(await new Bun.Glob('**/*').scan({ cwd: root }).next()).toEqual({
        value: undefined,
        done: true
      })
    } finally {
      await rm(root, { recursive: true })
    }
  })
})
