import list from '../../../mizan/data/sc-shariah-list-2026-05-29.json'

export interface ShariahSecurity {
  code: string
  name: string
  market: string | null
  kind: string
}

export const SC_LIST_DATE = list.effectiveDate
export const SC_LIST_STOCKS = list.counts.stocks
export const SC_SECURITIES: ShariahSecurity[] = list.securities

const byCode = new Map(SC_SECURITIES.map(s => [s.code, s]))

/** Bursa stock code (e.g. "5347") → SC-listed security, if any. */
export function findShariah(code: string): ShariahSecurity | undefined {
  return byCode.get(code.replace(/\.KL$/i, '').toUpperCase())
}

/** Yahoo Finance symbol for a Bursa stock code. */
export function toYahoo(code: string): string {
  return `${code}.KL`
}

export function searchShariah(query: string, limit = 8): ShariahSecurity[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return SC_SECURITIES
    .filter(s => s.code.toLowerCase().startsWith(q) || s.name.toLowerCase().includes(q))
    .slice(0, limit)
}

/** Large, liquid Main Market names on the SC list, shown until the user builds a watchlist. */
export const DEFAULT_WATCHLIST = ['5347', '5258', '1818', '5225', '6947', '5681', '5183', '5285', '8869', '0166', '5398', '7084']
