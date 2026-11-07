import { describe, expect, it } from 'vitest'
import { checkOrder, journalCsv, newAccount, parseAccount, placeOrder, type PaperOrder } from './paper'
import { findShariah } from './scList'

const isShariah = (code: string) => findShariah(code) != null
const order = (over: Partial<PaperOrder> = {}): PaperOrder => ({
  side: 'BUY', code: '5258', name: 'BANK ISLAM', qty: 1000, price: 1.94, priceDate: '2026-11-06', note: '', ...over,
})

describe('Mizan paper desk rules', () => {
  it('fills a Shariah-listed buy within cash', () => {
    const { account, entry } = placeOrder(newAccount(), order(), isShariah)
    expect(entry.status).toBe('filled')
    expect(account.cash).toBe(98_060)
    expect(account.positions['5258']).toEqual({ qty: 1000, cost: 1940 })
  })

  it('rejects a buy that is not on the SC list (Maybank)', () => {
    const { account, entry } = placeOrder(newAccount(), order({ code: '1155', name: 'MAYBANK', price: 10 }), isShariah)
    expect(entry).toMatchObject({ status: 'rejected', guard: 'shariah-sc-list' })
    expect(account.cash).toBe(100_000)
    expect(account.journal).toHaveLength(1)
  })

  it('rejects a buy above cash on hand', () => {
    expect(checkOrder(newAccount(), order({ code: '5347', qty: 10_000, price: 13 }), isShariah)?.guard).toBe('cash-only')
  })

  it('rejects an unpriced buy', () => {
    expect(checkOrder(newAccount(), order({ price: 0 }), isShariah)?.guard).toBe('cash-only')
  })

  it('rejects odd lots', () => {
    expect(checkOrder(newAccount(), order({ qty: 150 }), isShariah)?.guard).toBe('board-lot')
    expect(checkOrder(newAccount(), order({ qty: 0 }), isShariah)?.guard).toBe('board-lot')
  })

  it('rejects selling more than is held, and allows selling within holdings', () => {
    const bought = placeOrder(newAccount(), order(), isShariah).account
    expect(checkOrder(bought, order({ side: 'SELL', qty: 5000 }), isShariah)?.guard).toBe('no-short')
    expect(checkOrder(newAccount(), order({ side: 'SELL', qty: 100 }), isShariah)?.guard).toBe('no-short')
    const sold = placeOrder(bought, order({ side: 'SELL', qty: 500, price: 2 }), isShariah).account
    expect(sold.positions['5258']).toEqual({ qty: 500, cost: 970 })
    expect(sold.cash).toBe(99_060)
    const closed = placeOrder(sold, order({ side: 'SELL', qty: 500, price: 2 }), isShariah).account
    expect(closed.positions['5258']).toBeUndefined()
  })

  it('allows selling a holding that is no longer on the list', () => {
    const account = { ...newAccount(), positions: { '1155': { qty: 100, cost: 1000 } } }
    expect(checkOrder(account, order({ side: 'SELL', code: '1155', qty: 100, price: 10 }), isShariah)).toBeNull()
  })

  it('round-trips through storage and refuses malformed data', () => {
    const { account } = placeOrder(newAccount(), order({ note: 'my rule: under 5% per stock' }), isShariah)
    expect(parseAccount(JSON.stringify(account))).toEqual(account)
    expect(parseAccount('{"version":2}')).toBeNull()
    expect(parseAccount('not json')).toBeNull()
    expect(parseAccount(null)).toBeNull()
  })

  it('exports the journal oldest first as CSV with quoted notes', () => {
    let account = placeOrder(newAccount(), order({ note: 'plan, "A"' }), isShariah, new Date('2026-11-07T01:00:00Z')).account
    account = placeOrder(account, order({ code: '1155', name: 'MAYBANK' }), isShariah, new Date('2026-11-07T02:00:00Z')).account
    const lines = journalCsv(account.journal).trim().split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toContain('5258')
    expect(lines[1]).toContain('"plan, ""A"""')
    expect(lines[2]).toContain('shariah-sc-list')
  })
})
