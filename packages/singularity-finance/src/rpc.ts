import { createPublicClient, http } from 'viem'
import { type Chain, rpcUrl } from './config'
import { userAgent } from './http'

export function clientFor(chain: Chain, receipt = false) {
  return createPublicClient({
    transport: http(rpcUrl(chain, receipt), {
      fetchOptions: { headers: { 'User-Agent': userAgent } },
      retryCount: 2,
      timeout: 20_000
    })
  })
}

export type Client = ReturnType<typeof clientFor>

export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json }

export function normalize(value: unknown): Json {
  if (typeof value === 'bigint') return value.toString()
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, normalize(item)])
    )
  throw new Error(`Cannot serialize ${String(value)}`)
}

export function errorMessage(error: unknown): string {
  let message = error instanceof Error ? error.message : String(error)
  for (const [key, value] of Object.entries(process.env)) {
    if ((key.startsWith('SFI_RPC_') || key === 'SFI_3XPL_TOKEN') && value)
      message = message
        .replaceAll(value, '[redacted]')
        .replaceAll(encodeURIComponent(value), '[redacted]')
  }
  return message
}

export async function assertChain(client: Client, id: number) {
  const actual = await client.getChainId()
  if (actual !== id)
    throw new Error(`RPC chain mismatch: expected ${id}, got ${actual}`)
}

export async function pinnedBlock(client: Client, blockNumber?: bigint) {
  const block = await client.getBlock(
    blockNumber === undefined ? { blockTag: 'latest' } : { blockNumber }
  )
  if (block.number === null || !block.hash)
    throw new Error('Incomplete block identity')
  return {
    number: block.number,
    hash: block.hash,
    time: new Date(Number(block.timestamp) * 1000).toISOString()
  }
}
