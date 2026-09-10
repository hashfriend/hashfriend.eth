import { afterEach, expect, test } from 'bun:test'
import { getChain } from './config'
import { clientFor } from './rpc'

const base = getChain('base')
const previousRpc = process.env.SFI_RPC_8453

afterEach(() => {
  if (previousRpc === undefined) delete process.env.SFI_RPC_8453
  else process.env.SFI_RPC_8453 = previousRpc
})

test('spaces requests from separate clients', async () => {
  const starts: number[] = []
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch() {
      starts.push(Date.now())
      return Response.json({ jsonrpc: '2.0', id: 1, result: '0x2105' })
    }
  })
  process.env.SFI_RPC_8453 = server.url.toString()

  try {
    await Promise.all([
      clientFor(base).getChainId(),
      clientFor(base).getChainId(),
      clientFor(base).getChainId()
    ])
  } finally {
    server.stop()
  }

  expect(starts).toHaveLength(3)
  expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(200)
  expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(200)
})

test('retries a rate-limit error', async () => {
  let attempts = 0
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch() {
      attempts += 1
      if (attempts === 1)
        return Response.json({
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32005, message: 'rate limited' }
        })
      return Response.json({ jsonrpc: '2.0', id: 1, result: '0x2105' })
    }
  })
  process.env.SFI_RPC_8453 = server.url.toString()

  try {
    await expect(clientFor(base).getChainId()).resolves.toBe(8453)
  } finally {
    server.stop()
  }

  expect(attempts).toBe(2)
})

test('surfaces a permanent invalid-params error once', async () => {
  let attempts = 0
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch() {
      attempts += 1
      return Response.json({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32602, message: 'invalid params' }
      })
    }
  })
  process.env.SFI_RPC_8453 = server.url.toString()

  try {
    await expect(clientFor(base).getChainId()).rejects.toThrow('invalid params')
  } finally {
    server.stop()
  }

  expect(attempts).toBe(1)
})
