/**
 * Mizan web desk: a paper account that lives in the browser.
 *
 * Orders fill at the last daily close and pass the same rules as the UTA
 * guards in services/uta/src/domain/trading/guards/ (shariah-sc-list,
 * no-short, cash-only), plus Bursa's 100-share board lot. Rejected orders are
 * kept in the journal with the rule that stopped them.
 */

export type Side = 'BUY' | 'SELL'

export interface Position {
  qty: number
  /** Total cost of the shares held, in RM. Average cost = cost / qty. */
  cost: number
}

export interface JournalEntry {
  id: string
  at: string
  side: Side
  code: string
  name: string
  qty: number
  price: number
  /** Close date the order was priced at. */
  priceDate: string
  note: string
  status: 'filled' | 'rejected'
  guard?: GuardName
  reason?: string
}

export interface PaperAccount {
  version: 1
  startingCash: number
  cash: number
  positions: Record<string, Position>
  journal: JournalEntry[]
}

export interface PaperOrder {
  side: Side
  code: string
  name: string
  qty: number
  price: number
  priceDate: string
  note: string
}

export type GuardName = 'shariah-sc-list' | 'no-short' | 'cash-only' | 'board-lot'

export interface Rejection {
  guard: GuardName
  reason: string
}

export const STARTING_CASH = 100_000
export const BOARD_LOT = 100

export function newAccount(startingCash = STARTING_CASH): PaperAccount {
  return { version: 1, startingCash, cash: startingCash, positions: {}, journal: [] }
}

/** The first rule the order breaks, or null if it may fill. */
export function checkOrder(account: PaperAccount, order: PaperOrder, isShariah: (code: string) => boolean): Rejection | null {
  if (!Number.isInteger(order.qty) || order.qty <= 0 || order.qty % BOARD_LOT !== 0) {
    return { guard: 'board-lot', reason: `Bursa trades in board lots of ${BOARD_LOT} shares; enter a quantity like 100, 500 or 1,000` }
  }
  if (order.side === 'BUY') {
    if (!isShariah(order.code)) {
      return { guard: 'shariah-sc-list', reason: `${order.code} is not on the SC Shariah-compliant list` }
    }
    if (!(order.price > 0)) {
      return { guard: 'cash-only', reason: 'Cannot price this order, so it cannot be checked against cash on hand' }
    }
    const cost = order.qty * order.price
    if (cost > account.cash + 1e-9) {
      return { guard: 'cash-only', reason: `Order costs ${money(cost)} but only ${money(account.cash)} cash is available; margin is not allowed` }
    }
    return null
  }
  const held = account.positions[order.code]?.qty ?? 0
  if (order.qty > held) {
    return { guard: 'no-short', reason: `Selling ${order.qty} shares but only ${held} are held; short selling is not allowed` }
  }
  return null
}

/** Apply an order: fill it if it passes the rules, otherwise journal the rejection. */
export function placeOrder(
  account: PaperAccount,
  order: PaperOrder,
  isShariah: (code: string) => boolean,
  now = new Date(),
): { account: PaperAccount; entry: JournalEntry } {
  const rejection = checkOrder(account, order, isShariah)
  const entry: JournalEntry = {
    id: `${now.getTime().toString(36)}-${account.journal.length}`,
    at: now.toISOString(),
    side: order.side,
    code: order.code,
    name: order.name,
    qty: order.qty,
    price: order.price,
    priceDate: order.priceDate,
    note: order.note.trim(),
    status: rejection ? 'rejected' : 'filled',
    ...(rejection ? { guard: rejection.guard, reason: rejection.reason } : {}),
  }
  if (rejection) return { account: { ...account, journal: [entry, ...account.journal] }, entry }

  const positions = { ...account.positions }
  const value = order.qty * order.price
  const held = positions[order.code]
  let cash = account.cash
  if (order.side === 'BUY') {
    positions[order.code] = { qty: (held?.qty ?? 0) + order.qty, cost: (held?.cost ?? 0) + value }
    cash -= value
  } else {
    const remaining = held!.qty - order.qty
    if (remaining === 0) delete positions[order.code]
    else positions[order.code] = { qty: remaining, cost: held!.cost * (remaining / held!.qty) }
    cash += value
  }
  return { account: { ...account, cash: round2(cash), positions, journal: [entry, ...account.journal] }, entry }
}

/** Parse a saved account, or null if it is missing or malformed. */
export function parseAccount(raw: string | null): PaperAccount | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<PaperAccount>
    if (value.version !== 1 || typeof value.cash !== 'number' || typeof value.startingCash !== 'number') return null
    if (!value.positions || typeof value.positions !== 'object' || !Array.isArray(value.journal)) return null
    return value as PaperAccount
  } catch {
    return null
  }
}

export function journalCsv(journal: JournalEntry[]): string {
  const header = ['time', 'side', 'code', 'name', 'qty', 'price_rm', 'price_date', 'status', 'rule', 'reason', 'note']
  const rows = [...journal].reverse().map(e => [
    e.at, e.side, e.code, e.name, String(e.qty), e.price.toFixed(3), e.priceDate, e.status, e.guard ?? '', e.reason ?? '', e.note,
  ])
  return [header, ...rows].map(r => r.map(csvCell).join(',')).join('\n') + '\n'
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function money(n: number): string {
  return `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
