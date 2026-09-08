import { isAddress } from 'viem'
import { object } from './http'
import { type Json, normalize } from './rpc'

export function validateSnapshot(value: unknown) {
  const snapshot = object(value)
  if (
    snapshot.schemaVersion !== 2 ||
    !Array.isArray(snapshot.chains) ||
    snapshot.chains.length === 0 ||
    typeof snapshot.capturedAt !== 'string' ||
    snapshot.abiPolicy !== 'verified-address-cache-v1'
  )
    throw new Error('Expected a schemaVersion 2 snapshot')
  const ids = new Set<number>()
  for (const raw of snapshot.chains) {
    const chain = object(raw)
    if (typeof chain.chainId !== 'number' || ids.has(chain.chainId))
      throw new Error('Missing or duplicate chain ID')
    ids.add(chain.chainId)
    if (
      chain.complete !== true ||
      !Array.isArray(chain.errors) ||
      chain.errors.length !== 0
    )
      throw new Error(
        `Incomplete snapshot for ${chain.chain}; inspect errors before comparing`
      )
    const block = object(chain.block)
    if (
      typeof block.hash !== 'string' ||
      !/^0x[0-9a-fA-F]{64}$/.test(block.hash) ||
      !/^\d+$/.test(String(block.number))
    )
      throw new Error('Snapshot lacks pinned block identity')
    for (const field of ['entries', 'vaults', 'excluded', 'safes', 'oracles'])
      if (!Array.isArray(chain[field]))
        throw new Error(`Missing ${field} for ${chain.chain}`)
    if (!Array.isArray(chain.abiEvidence))
      throw new Error(`Missing abiEvidence for ${chain.chain}`)
    for (const rawEvidence of chain.abiEvidence) {
      const evidence = object(rawEvidence)
      if (
        typeof evidence.address !== 'string' ||
        !isAddress(evidence.address) ||
        typeof evidence.codeHash !== 'string' ||
        !/^0x[0-9a-fA-F]{64}$/.test(evidence.codeHash) ||
        (evidence.sourceAddress !== null &&
          (typeof evidence.sourceAddress !== 'string' ||
            !isAddress(evidence.sourceAddress)))
      )
        throw new Error(`Invalid abiEvidence for ${chain.chain}`)
    }
    const entries = chain.entries as unknown[]
    const observed = [
      ...(chain.vaults as unknown[]),
      ...(chain.excluded as unknown[])
    ]
    const addresses = (items: unknown[], key: string) =>
      items
        .map((item) => {
          const address = object(item)[key]
          if (typeof address !== 'string' || !isAddress(address))
            throw new Error(`Invalid ${key} in snapshot`)
          return address.toLowerCase()
        })
        .sort()
    const expected = addresses(entries, 'vault')
    const actual = addresses(observed, 'address')
    if (
      new Set(expected).size !== expected.length ||
      JSON.stringify(expected) !== JSON.stringify(actual)
    )
      throw new Error(`Registry coverage mismatch for ${chain.chain}`)
  }
  return snapshot
}

function flatten(value: Json, path: string, result: Map<string, Json>) {
  if (Array.isArray(value)) {
    if (
      value.length &&
      value.every(
        (item) =>
          item &&
          !Array.isArray(item) &&
          typeof item === 'object' &&
          (typeof item.address === 'string' ||
            typeof item.vault === 'string' ||
            typeof item.account === 'string')
      )
    ) {
      for (const item of value) {
        const row = item as Record<string, Json>
        const id = String(row.address ?? row.vault ?? row.account).toLowerCase()
        flatten(row, `${path}/${id}`, result)
      }
    } else result.set(path, value)
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value))
      flatten(item, `${path}/${key}`, result)
  } else result.set(path, value)
}

function state(snapshot: Record<string, unknown>) {
  const result = new Map<string, Json>()
  for (const raw of snapshot.chains as unknown[]) {
    const chain = object(raw)
    for (const key of ['registry', 'entries', 'vaults', 'safes', 'oracles'])
      flatten(normalize(chain[key]), `${chain.chainId}/${key}`, result)
  }
  return result
}

export function diffSnapshots(before: unknown, after: unknown) {
  const old = validateSnapshot(before),
    current = validateSnapshot(after)
  const scope = (snapshot: Record<string, unknown>) =>
    (snapshot.chains as unknown[])
      .map((chain) => object(chain).chainId)
      .sort()
      .join(',')
  if (scope(old) !== scope(current) || old.abiPolicy !== current.abiPolicy)
    throw new Error('Compare snapshots with the same chains and ABI policy')
  const a = state(old),
    b = state(current)
  const changes = [...new Set([...a.keys(), ...b.keys()])]
    .sort()
    .filter((key) => JSON.stringify(a.get(key)) !== JSON.stringify(b.get(key)))
    .map((path) => ({
      path,
      before: a.get(path) ?? null,
      after: b.get(path) ?? null
    }))
  return { before: old.capturedAt, after: current.capturedAt, changes }
}
