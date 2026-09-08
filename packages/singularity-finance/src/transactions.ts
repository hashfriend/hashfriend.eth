import { type Abi, decodeFunctionData, type Hex } from 'viem'
import type { Chain } from './config'
import { ContractCache } from './contracts'
import {
  assertChain,
  clientFor,
  errorMessage,
  normalize,
  pinnedBlock
} from './rpc'

export function decodeInput(abi: Abi, data: Hex) {
  return normalize(decodeFunctionData({ abi, data }))
}

export async function transaction(chain: Chain, hash: Hex) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash))
    throw new Error('Expected a 32-byte transaction hash')
  const client = clientFor(chain)
  const receiptClient = clientFor(chain, true)
  await assertChain(client, chain.id)
  await assertChain(receiptClient, chain.id)
  const [tx, receipt] = await Promise.all([
    client.getTransaction({ hash }),
    receiptClient.getTransactionReceipt({ hash })
  ])
  if (tx.blockNumber === null) throw new Error('Transaction is not mined')
  if (tx.blockHash !== receipt.blockHash)
    throw new Error('Transaction and receipt block hashes disagree')
  const block = await pinnedBlock(client, tx.blockNumber)
  if (block.hash !== receipt.blockHash)
    throw new Error('Transaction block is no longer canonical')
  const cache = new ContractCache(client, chain.id, block.number)
  let decoded: ReturnType<typeof decodeInput>
  try {
    if (!tx.to)
      throw new Error(
        'Contract creation has no target ABI; inspect raw creation input'
      )
    decoded = decodeInput((await cache.resolve(tx.to)).abi, tx.input)
  } catch (error) {
    return {
      chain: chain.name,
      block,
      transaction: tx,
      receipt,
      complete: false,
      decodingError: errorMessage(error),
      abiEvidence: cache.evidence()
    }
  }
  return {
    chain: chain.name,
    block,
    transaction: tx,
    receipt,
    complete: true,
    abiEvidence: cache.evidence(),
    decoded
  }
}
