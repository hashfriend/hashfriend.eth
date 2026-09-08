import { describe, expect, test } from 'bun:test'
import type { Address } from 'viem'

import { parseVerifiedSource, verifiedSourceUrl } from './verified-source'

const address = '0x0000000000000000000000000000000000000001' as Address
const baseResponse = {
  status: '1',
  result: [
    {
      Address: address,
      ContractName: 'Vault',
      SourceCode: 'contract Vault {}',
      ABI: '[{"type":"function","name":"totalAssets","inputs":[],"outputs":[],"stateMutability":"view"}]',
      CompilerVersion: 'v0.8.24+commit.e11b9ed9',
      ExternalLibraries: [
        { address_hash: '0x0000000000000000000000000000000000000002' }
      ],
      Proxy: '0'
    }
  ]
}

describe('verified source provider', () => {
  test('selects the exact requested address and parses ABI and libraries', () => {
    const source = parseVerifiedSource(
      1,
      address,
      verifiedSourceUrl(1, address),
      baseResponse
    )
    expect(source.address).toBe(address)
    expect(source.contractName).toBe('Vault')
    expect(source.abi).toHaveLength(1)
    expect(source.libraries).toEqual([
      '0x0000000000000000000000000000000000000002'
    ])
    expect(source.sources).toEqual({ 'Vault.sol': 'contract Vault {}' })
    expect(source.proxy).toBe(false)
    expect(source.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  test('rejects a response whose result has no exact address match', () => {
    expect(() =>
      parseVerifiedSource(1, address, verifiedSourceUrl(1, address), {
        ...baseResponse,
        result: [
          {
            ...baseResponse.result[0],
            Address: '0x0000000000000000000000000000000000000003'
          }
        ]
      })
    ).toThrow('exact address match')
  })

  test('rejects empty source', () => {
    expect(() =>
      parseVerifiedSource(1, address, verifiedSourceUrl(1, address), {
        ...baseResponse,
        result: [
          { ...baseResponse.result[0], SourceCode: '', AdditionalSources: [] }
        ]
      })
    ).toThrow('no source')
  })

  test('rejects malformed ABI', () => {
    expect(() =>
      parseVerifiedSource(1, address, verifiedSourceUrl(1, address), {
        ...baseResponse,
        result: [{ ...baseResponse.result[0], ABI: '{not-json}' }]
      })
    ).toThrow()
  })

  test('parses Blockscout multi-file source and additional sources', () => {
    const source = parseVerifiedSource(
      10,
      address,
      verifiedSourceUrl(10, address),
      {
        ...baseResponse,
        result: [
          {
            ...baseResponse.result[0],
            SourceCode: '{{"contracts/Vault.sol":"contract Vault {}"}}',
            AdditionalSources: [
              { Filename: 'contracts/Lib.sol', SourceCode: 'library Lib {}' }
            ]
          }
        ]
      }
    )
    expect(source.sources).toEqual({
      'contracts/Vault.sol': 'contract Vault {}',
      'contracts/Lib.sol': 'library Lib {}'
    })
  })

  test('keeps FileName for a plain single-file source', () => {
    const source = parseVerifiedSource(
      1,
      address,
      verifiedSourceUrl(1, address),
      {
        ...baseResponse,
        result: [{ ...baseResponse.result[0], FileName: 'src/Vault.sol' }]
      }
    )
    expect(source.sources).toEqual({ 'src/Vault.sol': 'contract Vault {}' })
  })

  test('parses Etherscan standard-input sources and compiler settings', () => {
    const source = parseVerifiedSource(
      1,
      address,
      verifiedSourceUrl(1, address),
      {
        ...baseResponse,
        result: [
          {
            ...baseResponse.result[0],
            SourceCode: JSON.stringify({
              language: 'Solidity',
              sources: { 'src/Vault.sol': { content: 'contract Vault {}' } },
              settings: { optimizer: { enabled: true, runs: 200 } }
            }),
            CompilerSettings: undefined
          }
        ]
      }
    )
    expect(source.sources).toEqual({ 'src/Vault.sol': 'contract Vault {}' })
    expect(source.compiler).toMatchObject({
      settings: { optimizer: { enabled: true, runs: 200 } }
    })
  })

  test('parses double-brace wrapped standard-input sources', () => {
    const source = parseVerifiedSource(
      1,
      address,
      verifiedSourceUrl(1, address),
      {
        ...baseResponse,
        result: [
          {
            ...baseResponse.result[0],
            SourceCode:
              '{{"language":"Solidity","sources":{"A.sol":{"content":"contract A {}"}},"settings":{"optimizer":{"enabled":false}}}}'
          }
        ]
      }
    )
    expect(source.sources).toEqual({ 'A.sol': 'contract A {}' })
    expect(source.compiler).toMatchObject({
      settings: { optimizer: { enabled: false } }
    })
  })

  test('merges external and compiler-settings libraries', () => {
    const source = parseVerifiedSource(
      1,
      address,
      verifiedSourceUrl(1, address),
      {
        ...baseResponse,
        result: [
          {
            ...baseResponse.result[0],
            CompilerSettings: {
              libraries: {
                'src/Vault.sol': {
                  Lib: '0x0000000000000000000000000000000000000003'
                }
              }
            }
          }
        ]
      }
    )
    expect(source.libraries).toEqual([
      '0x0000000000000000000000000000000000000002',
      '0x0000000000000000000000000000000000000003'
    ])
  })

  test('rejects ABI entries without a type', () => {
    expect(() =>
      parseVerifiedSource(1, address, verifiedSourceUrl(1, address), {
        ...baseResponse,
        result: [{ ...baseResponse.result[0], ABI: '[{"name":"bad"}]' }]
      })
    ).toThrow('invalid entry')
  })

  test('fails closed for BNB Chain', () => {
    expect(() => verifiedSourceUrl(56, address)).toThrow('BNB Chain')
  })
})
