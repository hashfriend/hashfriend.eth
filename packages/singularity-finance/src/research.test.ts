import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { encodeFunctionData, keccak256, parseAbi, toHex } from 'viem'
import { blockArgument, main, writeResult } from './cli'
import {
  chains,
  getChain,
  isCandidate,
  isProduction,
  oracleAdminRole,
  permittedUserRole
} from './config'
import { diffSnapshots, validateSnapshot } from './diff'
import { requestJson, userAgent } from './http'
import { errorMessage, normalize } from './rpc'
import { snapshotChain } from './snapshot'
import { decodeInput } from './transactions'

const address = '0x0000000000000000000000000000000000000001'
function fixture() {
  return {
    schemaVersion: 2,
    abiPolicy: 'verified-address-cache-v1',
    capturedAt: '2026-09-08T00:00:00Z',
    chains: [
      {
        chain: 'bnb',
        chainId: 56,
        complete: true,
        block: { number: '100', hash: `0x${'ab'.repeat(32)}` },
        registry: address,
        entries: [{ vault: address, vaultType: 1, active: true }],
        excluded: [],
        vaults: [{ address, symbol: 'dynBnbUSDT', permissionDisabled: false }],
        safes: [],
        oracles: [],
        abiEvidence: [
          {
            address,
            codeHash: `0x${'cd'.repeat(32)}`,
            sourceAddress: address
          }
        ],
        errors: []
      }
    ]
  }
}

describe('snapshot comparisons', () => {
  test('finds a permission change and ignores block identity changes', () => {
    const before = fixture(),
      after = fixture()
    after.chains[0].block.number = '101'
    after.chains[0].vaults[0].permissionDisabled = true
    expect(diffSnapshots(before, after).changes).toEqual([
      {
        path: `56/vaults/${address}/permissionDisabled`,
        before: false,
        after: true
      }
    ])
    expect(diffSnapshots(before, before).changes).toEqual([])
  })
  test('rejects partial reads and missing registry coverage', () => {
    const data = fixture()
    data.chains[0].complete = false
    expect(() => validateSnapshot(data)).toThrow('Incomplete')
    data.chains[0].complete = true
    data.chains[0].vaults = []
    expect(() => validateSnapshot(data)).toThrow('coverage')
  })
  test('rejects different chain scopes and ABI policies', () => {
    const before = fixture(),
      after = fixture()
    after.abiPolicy = 'unverified'
    expect(() => diffSnapshots(before, after)).toThrow('schemaVersion 2')
    after.abiPolicy = before.abiPolicy
    after.chains[0].chainId = 1
    expect(() => diffSnapshots(before, after)).toThrow('same chains and ABI')
  })
  test('rejects schema 1 snapshots', () => {
    const data = fixture()
    data.schemaVersion = 1
    expect(() => validateSnapshot(data)).toThrow('schemaVersion 2')
  })
  test('counts a successfully read empty registry', () => {
    const data = fixture()
    data.chains[0].entries = []
    data.chains[0].vaults = []
    expect(() => validateSnapshot(data)).not.toThrow()
  })
})

test('production filters match the post inventory convention', () => {
  expect(isCandidate(8453, 1)).toBe(false)
  expect(isCandidate(8453, 4)).toBe(true)
  expect(isCandidate(56, 1)).toBe(true)
  expect(isProduction('dynCLTestUSDC')).toBe(false)
  expect(isProduction('dynBnbGold')).toBe(true)
})

test('configured registries match the saved six-chain reads', async () => {
  const saved = await Bun.file(
    new URL('../evidence/2026-09-08-viem.json', import.meta.url)
  ).json()
  expect(chains.map(({ id, registry }) => ({ chainId: id, registry }))).toEqual(
    saved.chains.map(
      ({ chainId, registry }: { chainId: number; registry: string }) => ({
        chainId,
        registry
      })
    )
  )
})

test('role hashes preserve the distinct Solidity encodings', () => {
  expect(permittedUserRole).toBe(
    '0x4df3817562f6aefe3deb80604fbb8ba365320192d77c7a202383bff3ef9ba3b5'
  )
  expect(oracleAdminRole).not.toBe(keccak256(toHex('ORACLE_ADMIN')))
})

test('decodes permission transactions without losing unknown calldata', () => {
  const abi = parseAbi(['function setPermissionDisabled(bool)'])
  const data = encodeFunctionData({
    abi,
    functionName: 'setPermissionDisabled',
    args: [true]
  })
  expect(decodeInput(abi, data)).toEqual({
    functionName: 'setPermissionDisabled',
    args: [true]
  })
  expect(() => decodeInput(abi, '0xdeadbeef')).toThrow()
})

test('serializes large integers without floating point conversion', () => {
  expect(normalize({ amount: 12345678901234567890n })).toEqual({
    amount: '12345678901234567890'
  })
  expect(() => normalize(undefined)).toThrow()
  expect(normalize({ optionalRpcField: undefined })).toEqual({})
})

test('HTTP reads set Safari UA and preserve server errors', async () => {
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: (request) =>
      request.url.endsWith('/bad')
        ? new Response('archive unavailable', { status: 400 })
        : Response.json({ agent: request.headers.get('User-Agent') })
  })
  try {
    expect(await requestJson(server.url.href)).toEqual({ agent: userAgent })
    await expect(requestJson(`${server.url}bad`)).rejects.toThrow(
      'HTTP 400: archive unavailable'
    )
  } finally {
    server.stop(true)
  }
})

test('output refuses overwrites', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'sfi-output-'))
  try {
    const path = join(dir, 'snapshot.json')
    await writeResult({ value: 1n }, path)
    await expect(writeResult({ value: 2n }, path)).rejects.toThrow()
    expect(await Bun.file(path).json()).toEqual({ value: '1' })
  } finally {
    await rm(dir, { recursive: true })
  }
})

test('CLI rejects typos and incompatible flags before network calls', async () => {
  await expect(main(['snapshop'])).rejects.toThrow('Unknown command')
  await expect(main(['snapshot', '--block', '100'])).rejects.toThrow('--chain')
  await expect(main(['selector', 'foo()', '--chain', 'base'])).rejects.toThrow(
    'not valid'
  )
  expect(() => blockArgument('-1')).toThrow()
  expect(blockArgument('100')).toBe(100n)
  expect(errorMessage(new Error('RPC failed'))).toBe('RPC failed')
})

test('a failed RPC read cannot become an empty registry', async () => {
  const previous = process.env.SFI_RPC_56
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: async (request) => {
      const input = (await request.json()) as { id: number; method: string }
      return Response.json(
        input.method === 'eth_chainId'
          ? { jsonrpc: '2.0', id: input.id, result: '0x38' }
          : {
              jsonrpc: '2.0',
              id: input.id,
              error: { code: -32602, message: 'archive unavailable' }
            }
      )
    }
  })
  try {
    process.env.SFI_RPC_56 = server.url.href
    const result = await snapshotChain(getChain('bnb'))
    expect(result.complete).toBe(false)
    expect(result.entries).toBeNull()
    expect(result.errors[0].message).toContain('archive unavailable')
    expect(result.errors[0].message).not.toContain(server.url.href)
  } finally {
    if (previous === undefined) delete process.env.SFI_RPC_56
    else process.env.SFI_RPC_56 = previous
    server.stop(true)
  }
})
