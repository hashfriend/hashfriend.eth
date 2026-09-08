import { encodeAbiParameters, keccak256, toHex } from 'viem'

export const chains = [
  {
    id: 1,
    name: 'ethereum',
    rpc: 'https://ethereum-rpc.publicnode.com',
    registry: '0x97C46cE66Ec71559DbF43fF9E5D110C3657C1ca4'
  },
  {
    id: 10,
    name: 'optimism',
    rpc: 'https://optimism-rpc.publicnode.com',
    registry: '0x45585Acb41829139C7606ed6C4c5eaEC2DC50029'
  },
  {
    id: 42161,
    name: 'arbitrum',
    rpc: 'https://arbitrum-one-rpc.publicnode.com',
    registry: '0x44921e42017316F89C1DEdd70a3A017d4c5162c3'
  },
  {
    id: 56,
    name: 'bnb',
    rpc: 'https://bsc-rpc.publicnode.com',
    registry: '0xBCCa741996196462480108BCEf7561C0aB3Fdb04'
  },
  {
    id: 137,
    name: 'polygon',
    rpc: 'https://polygon-bor-rpc.publicnode.com',
    registry: '0x3Bfdf549881bFD92D4cce82e6C28f5391408B4cc'
  },
  {
    id: 8453,
    name: 'base',
    rpc: 'https://base-rpc.publicnode.com',
    registry: '0xe260c97949bB01E49c0af64a3525458197851657'
  }
] as const

export type Chain = (typeof chains)[number]
export const admin = '0xcd231d4ba7B15A4722ac057419D9cd7689e7b8db'
export const governanceSafe = '0x5bfc34fba904b7d93a13c381adcc47de657599ff'
export const feeSafe = '0x03301480Ab204c92C8927d76Bba989c6400860C6'
export const probeUser = '0x0000000000000000000000000000000000000001'
export const permittedUserRole = keccak256(toHex('PERMITTED_USER'))
export const oracleAdminRole = keccak256(
  encodeAbiParameters([{ type: 'string' }], ['ORACLE_ADMIN'])
)
export const baseOracles = [
  '0x184b2217fc07ecfa77c7a6df476b0814250be877',
  '0x6e03c0b5ed1b16a8fd3f04346846ef986cbfc0f1',
  '0x566bb935a22f6b18f351d79ea54e9fa83fc581fb'
] as const

export function getChain(name: string): Chain {
  const chain = chains.find((item) => item.name === name)
  if (!chain)
    throw new Error(
      `Unknown chain ${name}; use ${chains.map((item) => item.name).join(', ')}`
    )
  return chain
}

export function rpcUrl(chain: Chain, receipt = false): string {
  return (
    process.env[`SFI_RPC_${chain.id}`] ||
    (receipt && chain.id === 56
      ? 'https://bsc-dataseed.binance.org'
      : chain.rpc)
  )
}

export function isCandidate(chainId: number, type: number): boolean {
  return chainId !== 8453 || [3, 4].includes(type)
}

export function isProduction(symbol: string): boolean {
  return symbol.startsWith('dyn') && !symbol.includes('Test')
}
