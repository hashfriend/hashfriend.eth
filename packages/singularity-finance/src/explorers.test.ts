import { describe, expect, test } from 'bun:test'

import {
  blockscoutNextUrl,
  documentUrl,
  hasVerifiedSource,
  historyPageLimit,
  threeXplEventsUrl,
  validateBlockscoutPage,
  validateThreeXplPage
} from './explorers'

const address = '0x0000000000000000000000000000000000000001'

describe('explorer response parsers', () => {
  test('keeps Blockscout pagination parameters in the next URL', () => {
    const url = blockscoutNextUrl(address, 'to', { block_number: 10, index: 2 })
    expect(url).toContain('filter=to')
    expect(url).toContain('block_number=10')
    expect(url).toContain('index=2')
  })

  test('rejects malformed explorer pages', () => {
    expect(() => validateBlockscoutPage({})).toThrow()
    expect(() => validateThreeXplPage({ data: { events: [] } })).toThrow()
    expect(
      validateThreeXplPage({ data: { events: { transfers: [] } } })
    ).toEqual({
      data: { events: { transfers: [] } }
    })
  })

  test('formats 3xpl pages as negative indexes', () => {
    expect(threeXplEventsUrl(address, 0)).toContain('page=-0')
    expect(threeXplEventsUrl(address, 1)).toContain('page=-1')
  })

  test('rejects invalid history page limits', () => {
    expect(() => historyPageLimit(0)).toThrow()
    expect(() => historyPageLimit(51)).toThrow()
    expect(() => historyPageLimit(1.5)).toThrow()
  })

  test('requires a nonempty verified source', () => {
    expect(
      hasVerifiedSource({
        status: '1',
        result: [{ SourceCode: 'contract X {}' }]
      })
    ).toBe(true)
    expect(
      hasVerifiedSource({ status: '1', result: [{ SourceCode: '' }] })
    ).toBe(false)
    expect(
      hasVerifiedSource({
        status: '0',
        result: [{ SourceCode: 'contract X {}' }]
      })
    ).toBe(false)
  })

  test('accepts only HTTP document URLs', () => {
    expect(documentUrl('https://docs.singularityfinance.ai/guide')).toBe(
      'https://docs.singularityfinance.ai/guide'
    )
    expect(() => documentUrl('file:///tmp/source')).toThrow()
  })
})
