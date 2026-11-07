import { readFileSync } from 'node:fs'
import type { OperationGuard, GuardContext } from './types.js'

/**
 * Mizan: only ordinary shares on the Securities Commission Malaysia Shariah
 * Advisory Council list may be bought.
 *
 * - Every placeOrder must be a plain stock (secType STK). Forex, futures,
 *   options, warrants, CFD-like and crypto contracts are always rejected.
 * - BUY orders must be for a symbol on the list.
 * - SELL orders are allowed for any symbol, so a stock that is reclassified
 *   as non-compliant can still be disposed of.
 *
 * Options: `symbols` (string[]) or `listFile` (path to a JSON file holding
 * `{ "symbols": string[] }` or a plain array). Symbols are compared upper-case.
 */
export class ShariahScListGuard implements OperationGuard {
  readonly name = 'shariah-sc-list'
  private allowed: Set<string>

  constructor(options: Record<string, unknown>) {
    const symbols = (options.symbols as string[] | undefined)
      ?? (typeof options.listFile === 'string' ? loadListFile(options.listFile) : undefined)
    if (!symbols || symbols.length === 0) {
      throw new Error('shariah-sc-list guard requires a non-empty "symbols" array or a "listFile" in options')
    }
    this.allowed = new Set(symbols.map(s => s.trim().toUpperCase()))
  }

  check(ctx: GuardContext): string | null {
    const op = ctx.operation
    if (op.action !== 'placeOrder') return null

    const { contract, order } = op
    if (contract.secType !== 'STK') {
      return `Only ordinary shares are allowed; ${contract.secType || 'unknown'} contracts are not Shariah-screened`
    }
    if (order.action !== 'BUY') return null

    const symbol = (contract.symbol || '').toUpperCase()
    if (!this.allowed.has(symbol)) {
      return `${symbol || 'This symbol'} is not on the SC Shariah-compliant list`
    }
    return null
  }
}

function loadListFile(path: string): string[] {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (Array.isArray(parsed)) return parsed as string[]
  const symbols = (parsed as { symbols?: unknown }).symbols
  return Array.isArray(symbols) ? symbols as string[] : []
}
