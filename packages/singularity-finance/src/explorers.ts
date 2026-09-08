import { getAddress } from 'viem'

import { requestJson, requestText } from './http'

const MAX_PAGES = 50
const BASE_TRANSACTIONS = 'https://base.blockscout.com/api/v2/addresses'
const THREE_XPL = 'https://api.3xpl.com/bnb/address'

export type HistoryResult = {
  pages: unknown[]
  hasMore: boolean
  complete: false
}

export type DocumentSource = {
  url: string
  retrievedAt: string
  text: string
}

function addressOf(address: string): string {
  try {
    return getAddress(address)
  } catch {
    throw new Error(`Invalid EVM address: ${address}`)
  }
}

export function historyPageLimit(pages: number): number {
  if (!Number.isInteger(pages) || pages < 1 || pages > MAX_PAGES) {
    throw new Error(`pages must be an integer from 1 to ${MAX_PAGES}`)
  }
  return pages
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validateBlockscoutPage(
  value: unknown
): Record<string, unknown> {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error('Blockscout response must contain an items array')
  }
  if (
    'next_page_params' in value &&
    value.next_page_params !== null &&
    !isRecord(value.next_page_params)
  ) {
    throw new Error('Blockscout next_page_params must be an object or null')
  }
  return value
}

export function blockscoutNextUrl(
  address: string,
  direction: 'to' | 'from',
  nextPageParams?: Record<string, unknown> | null
): string {
  const url = new URL(`${BASE_TRANSACTIONS}/${addressOf(address)}/transactions`)
  url.searchParams.set('filter', direction)
  if (nextPageParams) {
    for (const [key, value] of Object.entries(nextPageParams)) {
      if (value === undefined || value === null) continue
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

export async function baseHistory(
  address: string,
  pages: number,
  direction: 'to' | 'from'
): Promise<HistoryResult> {
  const count = historyPageLimit(pages)
  const normalized = addressOf(address)
  const results: unknown[] = []
  let url = blockscoutNextUrl(normalized, direction)
  let hasMore = false

  for (let index = 0; index < count; index += 1) {
    const page = validateBlockscoutPage(await requestJson(url))
    results.push(page)
    const next = page.next_page_params
    hasMore = next !== null && next !== undefined
    if (!hasMore) break
    if (!isRecord(next))
      throw new Error('Blockscout next_page_params must be an object')
    url = blockscoutNextUrl(normalized, direction, next)
  }

  return { pages: results, hasMore, complete: false }
}

export function threeXplEventsUrl(address: string, page: number): string {
  if (!Number.isInteger(page) || page < 0)
    throw new Error('page must be a non-negative integer')
  const url = new URL(`${THREE_XPL}/${addressOf(address)}`)
  url.searchParams.set('data', 'events')
  url.searchParams.set('from', 'all')
  url.searchParams.set('limit', '100')
  url.searchParams.set('page', page === 0 ? '-0' : `-${page}`)
  return url.toString()
}

function withThreeXplToken(url: string, token: string): string {
  const authenticated = new URL(url)
  authenticated.searchParams.set('token', token)
  return authenticated.toString()
}

export function validateThreeXplPage(value: unknown): Record<string, unknown> {
  if (
    !isRecord(value) ||
    !isRecord(value.data) ||
    !isRecord(value.data.events)
  ) {
    throw new Error('3xpl response must contain data.events as an object')
  }
  if (Object.values(value.data.events).some((items) => !Array.isArray(items))) {
    throw new Error('3xpl data.events values must be arrays')
  }
  return value
}

export async function bnbHistory(
  address: string,
  pages: number
): Promise<HistoryResult> {
  const count = historyPageLimit(pages)
  const normalized = addressOf(address)
  const token = process.env.SFI_3XPL_TOKEN
  if (!token) throw new Error('SFI_3XPL_TOKEN is required')
  const results: unknown[] = []

  for (let index = 0; index < count; index += 1) {
    const page = validateThreeXplPage(
      await requestJson(
        withThreeXplToken(threeXplEventsUrl(normalized, index), token)
      )
    )
    results.push(page)
  }
  return { pages: results, hasMore: count > 0, complete: false }
}

export function documentUrl(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('Document URL must be an http(s) URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Document URL must be an http(s) URL')
  }
  return url.toString()
}

export async function documentSource(url: string): Promise<DocumentSource> {
  const normalized = documentUrl(url)
  const text = await requestText(normalized)
  return { url: normalized, retrievedAt: new Date().toISOString(), text }
}
