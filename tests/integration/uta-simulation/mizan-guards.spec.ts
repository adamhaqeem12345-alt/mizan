import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { Order } from '@traderalice/ibkr'
import { ShariahScListGuard } from '../../../services/uta/src/domain/trading/guards/shariah-sc-list.js'
import { NoShortGuard } from '../../../services/uta/src/domain/trading/guards/no-short.js'
import { CashOnlyGuard } from '../../../services/uta/src/domain/trading/guards/cash-only.js'
import { resolveGuards } from '../../../services/uta/src/domain/trading/guards/registry.js'
import type { GuardContext } from '../../../services/uta/src/domain/trading/guards/types.js'
import type { Operation } from '../../../services/uta/src/domain/trading/git/types.js'
import type { Position } from '../../../services/uta/src/domain/trading/brokers/types.js'
import type { SecType } from '@traderalice/ibkr'
import { makeContract, makePosition } from '../../../services/uta/src/domain/trading/brokers/mock/index.js'
import '../../../services/uta/src/domain/trading/contract-ext.js'

// Bursa stock codes; the list here is illustrative test data, not the SC list.
const LIST = ['5347', '1155']

function order(overrides: {
  symbol?: string
  secType?: SecType
  action?: 'BUY' | 'SELL'
  qty?: number
  limit?: number
  cash?: number
} = {}): Operation {
  const contract = makeContract({ symbol: overrides.symbol ?? '5347', secType: overrides.secType ?? 'STK', currency: 'MYR' })
  const o = new Order()
  o.action = overrides.action ?? 'BUY'
  o.orderType = overrides.limit != null ? 'LMT' : 'MKT'
  if (overrides.qty != null) o.totalQuantity = new Decimal(overrides.qty)
  if (overrides.limit != null) o.lmtPrice = new Decimal(overrides.limit)
  if (overrides.cash != null) o.cashQty = new Decimal(overrides.cash)
  return { action: 'placeOrder', contract, order: o }
}

function ctx(operation: Operation, positions: Position[] = [], cash = '10000'): GuardContext {
  return {
    operation,
    positions,
    account: { baseCurrency: 'MYR', netLiquidation: cash, totalCashValue: cash, unrealizedPnL: '0' },
  }
}

const held = (symbol: string, quantity: number, price = '10') =>
  makePosition({ contract: makeContract({ symbol, currency: 'MYR' }), quantity: new Decimal(quantity), marketPrice: price })

describe('ShariahScListGuard', () => {
  const guard = new ShariahScListGuard({ symbols: LIST })

  it('allows buying a listed stock', () => {
    expect(guard.check(ctx(order({ qty: 100, limit: 10 })))).toBeNull()
  })

  it('rejects buying an unlisted stock', () => {
    expect(guard.check(ctx(order({ symbol: '1023', qty: 100, limit: 10 })))).toContain('not on the SC Shariah-compliant list')
  })

  it.each(['CASH', 'FUT', 'OPT', 'WAR', 'CFD', 'CRYPTO', 'CRYPTO_PERP', 'CMDTY'] as SecType[])('rejects %s contracts even for listed symbols', (secType) => {
    expect(guard.check(ctx(order({ secType, qty: 1, limit: 1 })))).toContain('Only ordinary shares')
  })

  it('allows selling a stock that has dropped off the list', () => {
    expect(guard.check(ctx(order({ symbol: '1023', action: 'SELL', qty: 100 })))).toBeNull()
  })

  it('loads the published SC list from a file', () => {
    const fromFile = new ShariahScListGuard({ listFile: 'mizan/data/sc-shariah-list-2026-05-29.json' })
    expect(fromFile.check(ctx(order({ symbol: '5258', qty: 100, limit: 3 })))).toBeNull() // Bank Islam
    expect(fromFile.check(ctx(order({ symbol: '1155', qty: 100, limit: 3 })))).toContain('not on the SC') // Maybank
  })

  it('requires a symbol list', () => {
    expect(() => new ShariahScListGuard({})).toThrow('non-empty')
  })
})

describe('NoShortGuard', () => {
  const guard = new NoShortGuard()

  it('allows selling up to the shares held', () => {
    expect(guard.check(ctx(order({ action: 'SELL', qty: 100 }), [held('5347', 100)]))).toBeNull()
  })

  it('rejects selling more than held', () => {
    expect(guard.check(ctx(order({ action: 'SELL', qty: 150 }), [held('5347', 100)]))).toContain('short selling is not allowed')
  })

  it('rejects selling a stock not held', () => {
    expect(guard.check(ctx(order({ action: 'SELL', qty: 1 })))).toContain('only 0 held')
  })

  it('rejects a sell with no share quantity', () => {
    expect(guard.check(ctx(order({ action: 'SELL', cash: 500 }), [held('5347', 100)]))).toContain('must state a share quantity')
  })

  it('ignores buys', () => {
    expect(guard.check(ctx(order({ qty: 100, limit: 10 })))).toBeNull()
  })
})

describe('CashOnlyGuard', () => {
  const guard = new CashOnlyGuard()

  it('allows a limit buy within cash', () => {
    expect(guard.check(ctx(order({ qty: 1000, limit: 10 }), [], '10000'))).toBeNull()
  })

  it('rejects a buy that needs margin', () => {
    expect(guard.check(ctx(order({ qty: 1001, limit: 10 }), [], '10000'))).toContain('margin is not allowed')
  })

  it('prices a cash-amount buy', () => {
    expect(guard.check(ctx(order({ cash: 12000 }), [], '10000'))).toContain('12000.00')
  })

  it('prices a market buy from the held position', () => {
    expect(guard.check(ctx(order({ qty: 500 }), [held('5347', 10, '30')], '10000'))).toContain('15000.00')
  })

  it('rejects a market buy it cannot price', () => {
    expect(guard.check(ctx(order({ qty: 100 })))).toContain('Cannot price this order')
  })
})

describe('Mizan guards in the registry', () => {
  it('resolves all three from config', () => {
    const guards = resolveGuards([
      { type: 'shariah-sc-list', options: { symbols: LIST } },
      { type: 'no-short' },
      { type: 'cash-only' },
    ])
    expect(guards.map(g => g.name)).toEqual(['shariah-sc-list', 'no-short', 'cash-only'])
  })
})
