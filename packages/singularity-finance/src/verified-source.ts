import type { Abi, Address } from 'viem'
import { getAddress } from 'viem'

import { object, requestJson } from './http'

const BLOCKSCOUT_APIS: Record<number, string> = {
  8453: 'https://base.blockscout.com/api',
  1: 'https://eth.blockscout.com/api',
  10: 'https://optimism.blockscout.com/api',
  137: 'https://polygon.blockscout.com/api',
  42161: 'https://arbitrum.blockscout.com/api'
}

export type VerifiedSource = {
  provider: string
  url: string
  address: Address
  contractName: string
  abi: Abi
  sources: Record<string, string>
  compiler: unknown
  libraries: Address[]
  raw: unknown
  proxy: boolean
  retrievedAt: string
}

type SourceEntry = Record<string, unknown>

function isRecord(value: unknown): value is SourceEntry {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonemptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Verified source response has no ${field}`)
  }
  return value.trim()
}

function parseAbi(value: unknown): Abi {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value
  if (!Array.isArray(parsed))
    throw new Error('Verified source ABI must be an array')
  for (const entry of parsed) {
    if (!isRecord(entry) || typeof entry.type !== 'string')
      throw new Error('Verified source ABI has an invalid entry')
    if ('inputs' in entry && !Array.isArray(entry.inputs))
      throw new Error('Verified source ABI entry inputs must be an array')
    if ('outputs' in entry && !Array.isArray(entry.outputs))
      throw new Error('Verified source ABI entry outputs must be an array')
  }
  return parsed as Abi
}

type SourceFiles = { files: Record<string, string>; settings?: unknown }

function parseSourceObject(value: SourceEntry): SourceFiles | undefined {
  if (!isRecord(value.sources)) return undefined
  const files: Record<string, string> = {}
  for (const [label, file] of Object.entries(value.sources)) {
    if (
      !isRecord(file) ||
      typeof file.content !== 'string' ||
      file.content.trim() === ''
    ) {
      throw new Error(`Verified source file ${label} is empty`)
    }
    files[label] = file.content
  }
  return { files, settings: value.settings }
}

function parseSourceFiles(
  value: unknown,
  contractName: string,
  fileName?: unknown
): SourceFiles {
  if (typeof value !== 'string' || value.trim() === '') return { files: {} }
  const source = value.trim()
  if (source.startsWith('{{') && source.endsWith('}}')) {
    let parsed: unknown
    try {
      parsed = JSON.parse(source.slice(1, -1))
    } catch {
      throw new Error('Verified source multi-file payload is malformed')
    }
    if (!isRecord(parsed))
      throw new Error('Verified source multi-file payload must be an object')
    const standard = parseSourceObject(parsed)
    if (standard) return standard
    const files: Record<string, string> = {}
    for (const [label, content] of Object.entries(parsed)) {
      if (typeof content !== 'string' || content.trim() === '') {
        throw new Error(`Verified source file ${label} is empty`)
      }
      files[label] = content
    }
    return { files }
  }
  if (source.startsWith('{') && source.endsWith('}')) {
    let parsed: unknown
    try {
      parsed = JSON.parse(source)
    } catch {
      throw new Error('Verified source standard-input payload is malformed')
    }
    if (isRecord(parsed)) {
      const standard = parseSourceObject(parsed)
      if (standard) return standard
    }
  }
  const label =
    typeof fileName === 'string' && fileName.trim() !== ''
      ? fileName.trim()
      : `${contractName}.sol`
  return { files: { [label]: value } }
}

function parseAdditionalSources(value: unknown): Record<string, string> {
  if (value === undefined || value === null || value === '') return {}
  let parsed: unknown = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      throw new Error('Verified additional sources payload is malformed')
    }
  }
  if (!Array.isArray(parsed))
    throw new Error('Verified additional sources must be an array')
  const files: Record<string, string> = {}
  for (const item of parsed) {
    if (!isRecord(item))
      throw new Error('Verified additional source must be an object')
    const label = nonemptyString(
      item.Filename ?? item.filename,
      'additional source filename'
    )
    const source = nonemptyString(
      item.SourceCode ?? item.sourceCode,
      `additional source ${label}`
    )
    files[label] = source
  }
  return files
}

function parseAddress(value: unknown, field: string): Address {
  if (typeof value !== 'string')
    throw new Error(`Verified source ${field} is not an address`)
  try {
    return getAddress(value)
  } catch {
    throw new Error(`Verified source ${field} is not an address`)
  }
}

function exactEntry(result: unknown, address: Address): SourceEntry {
  if (!Array.isArray(result))
    throw new Error('Verified source response result must be an array')
  const match = result.find((item) => {
    if (!isRecord(item)) return false
    const candidate = item.Address ?? item.address
    return (
      typeof candidate === 'string' &&
      candidate.toLowerCase() === address.toLowerCase()
    )
  })
  if (!isRecord(match))
    throw new Error('Verified source response has no exact address match')
  return match
}

function compilerInfo(entry: SourceEntry, standardSettings?: unknown): unknown {
  return {
    version: entry.CompilerVersion ?? null,
    optimizationUsed: entry.OptimizationUsed ?? null,
    runs: entry.OptimizationRuns ?? entry.Runs ?? null,
    evmVersion: entry.EVMVersion ?? null,
    settings: entry.CompilerSettings ?? standardSettings ?? null,
    fileName: entry.FileName ?? null
  }
}

function parseLibraries(value: unknown): Address[] {
  if (value === undefined || value === null) return []
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (!isRecord(item))
        throw new Error('Verified source library must be an object')
      return parseAddress(item.address_hash ?? item.address, 'library address')
    })
  }
  if (!isRecord(value))
    throw new Error('Verified source libraries must be an array or object')
  const addresses: Address[] = []
  for (const [sourceFile, libraries] of Object.entries(value)) {
    if (!isRecord(libraries))
      throw new Error(
        `Verified source libraries for ${sourceFile} must be an object`
      )
    for (const [name, address] of Object.entries(libraries)) {
      addresses.push(parseAddress(address, `library ${name}`))
    }
  }
  return addresses
}

function parseCompilerSettingsLibraries(value: unknown): Address[] {
  if (value === undefined || value === null) return []
  let settings: unknown = value
  if (typeof value === 'string') {
    try {
      settings = JSON.parse(value)
    } catch {
      throw new Error('Verified compiler settings are malformed')
    }
  }
  if (!isRecord(settings))
    throw new Error('Verified compiler settings must be an object')
  return parseLibraries(settings.libraries)
}

export function verifiedSourceUrl(chainId: number, address: Address): string {
  const base = BLOCKSCOUT_APIS[chainId]
  if (!base) {
    if (chainId === 56)
      throw new Error('No verified source provider configured for BNB Chain')
    throw new Error(
      `No verified source provider configured for chain ${chainId}`
    )
  }
  const url = new URL(base)
  url.searchParams.set('module', 'contract')
  url.searchParams.set('action', 'getsourcecode')
  url.searchParams.set('address', address)
  return url.toString()
}

export function parseVerifiedSource(
  _chainId: number,
  address: Address,
  url: string,
  raw: unknown,
  retrievedAt = new Date().toISOString()
): VerifiedSource {
  const response = object(raw)
  if (response.status !== '1')
    throw new Error('Verified source provider returned status other than 1')
  const entry = exactEntry(response.result, address)
  const contractName = nonemptyString(entry.ContractName, 'contract name')
  const mainSources = parseSourceFiles(
    entry.SourceCode,
    contractName,
    entry.FileName
  )
  const sources = {
    ...mainSources.files,
    ...parseAdditionalSources(entry.AdditionalSources)
  }
  if (Object.keys(sources).length === 0)
    throw new Error('Verified source response has no source')
  const abi = parseAbi(entry.ABI)
  const compilerSettings = entry.CompilerSettings ?? mainSources.settings
  const libraries = [
    ...parseLibraries(entry.ExternalLibraries),
    ...parseCompilerSettingsLibraries(compilerSettings)
  ]
  const proxy =
    entry.IsProxy === true ||
    entry.IsProxy === 'true' ||
    entry.Proxy === true ||
    entry.Proxy === 1 ||
    entry.Proxy === '1'
  return {
    provider: 'blockscout',
    url,
    address,
    contractName,
    abi,
    sources,
    compiler: compilerInfo(entry, mainSources.settings),
    libraries: [
      ...new Map(libraries.map((item) => [item.toLowerCase(), item])).values()
    ],
    raw,
    proxy,
    retrievedAt
  }
}

export async function fetchVerifiedSource(
  chainId: number,
  address: Address
): Promise<VerifiedSource> {
  const normalized = parseAddress(address, 'address')
  const url = verifiedSourceUrl(chainId, normalized)
  const raw = await requestJson(url)
  return parseVerifiedSource(chainId, normalized, url, raw)
}
