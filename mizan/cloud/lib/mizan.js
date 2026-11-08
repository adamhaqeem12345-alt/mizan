// Shared Mizan data and logic for the public API and the MCP server.
import list from './sc-list.json' with { type: 'json' }
import { fetchBursaBars } from './bars.js'
import { forecastRange, priceStats } from './forecast.js'

export const DISCLAIMER =
  'Mizan is a demo and learning tool. This is not investment advice and not a recommendation to buy, sell or hold. ' +
  'Check Shariah status with the latest Securities Commission Malaysia list and a qualified adviser. ' +
  'Prices are Yahoo Finance daily closes (delayed, unofficial).'

export const SOURCE = {
  shariahList: list.sourceUrl,
  code: 'https://github.com/adamhaqeem12345-alt/mizan',
  app: 'https://mizan.cuddleia.com',
}

const byCode = new Map(list.securities.map(s => [s.code.toUpperCase(), s]))
const CODE = /^\d{4}[A-Z0-9]{0,2}$/

/** Stock code from "5347", "5347.KL" or " 5347 ". Returns null if it is not a Bursa code. */
export function normaliseCode(input) {
  const code = String(input ?? '').trim().toUpperCase().replace(/\.KL$/, '')
  return CODE.test(code) ? code : null
}

/** Next SC list update: the last Friday of May or November after the current list date. */
export function nextListUpdate(after = list.effectiveDate) {
  const from = new Date(`${after}T00:00:00Z`)
  for (let y = from.getUTCFullYear(); y <= from.getUTCFullYear() + 1; y++) {
    for (const month of [4, 10]) {
      const d = new Date(Date.UTC(y, month + 1, 0))
      while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() - 1)
      if (d > from) return d.toISOString().slice(0, 10)
    }
  }
  return null
}

export function listInfo() {
  return {
    source: 'Securities Commission Malaysia, Shariah Advisory Council',
    sourceUrl: list.sourceUrl,
    effectiveDate: list.effectiveDate,
    nextExpectedUpdate: nextListUpdate(),
    stocks: list.counts.stocks,
    islamicBusinessTrusts: list.counts.islamicBusinessTrusts,
  }
}

/** Shariah status of one stock code against the SC list. */
export function shariahStatus(input) {
  const code = normaliseCode(input)
  if (!code) return { error: 'Give a Bursa stock code such as 5347 or 5347.KL. Use search for names.' }
  const s = byCode.get(code)
  return {
    code,
    name: s?.name ?? null,
    market: s?.market ?? null,
    kind: s?.kind ?? null,
    shariahCompliant: Boolean(s),
    listDate: list.effectiveDate,
    note: s
      ? 'On the SC Shariah-compliant list.'
      : 'Not on the SC Shariah-compliant list (or not a listed Bursa code). Codes are checked exactly; search by name if unsure.',
  }
}

/** Search the SC list by code prefix or name. */
export function searchStocks(query, limit = 10) {
  const q = String(query ?? '').trim().toLowerCase()
  const n = Math.min(Math.max(Number(limit) || 10, 1), 50)
  if (!q) return []
  return list.securities
    .filter(s => s.code.toLowerCase().startsWith(q) || s.name.toLowerCase().includes(q))
    .slice(0, n)
    .map(s => ({ code: s.code, name: s.name, market: s.market, kind: s.kind }))
}

/** Daily bars for a Bursa code, oldest first. */
export async function priceHistory(input, days = 260) {
  const code = normaliseCode(input)
  if (!code) return { error: 'Give a Bursa stock code such as 5347 or 5347.KL.' }
  const count = Math.min(Math.max(Number(days) || 260, 5), 1300)
  const bars = await fetchBursaBars(`${code}.KL`, count)
  return { code, symbol: `${code}.KL`, days: bars.length, bars }
}

/** The dashboard's forecast range plus how often that method held over the past year. */
export async function forecast(input, horizon = 20) {
  const code = normaliseCode(input)
  if (!code) return { error: 'Give a Bursa stock code such as 5347 or 5347.KL.' }
  const h = Math.min(Math.max(Number(horizon) || 20, 5), 60)
  const bars = await fetchBursaBars(`${code}.KL`, 520)
  const series = bars.map(b => ({ date: b.date, close: b.close }))
  const result = forecastRange(series, h)
  if (!result) return { code, error: 'Not enough price history (needs at least 60 trading days).' }
  const last = series.at(-1)
  const end = result.points.at(-1)
  return {
    code,
    shariahCompliant: byCode.has(code),
    lastClose: last,
    horizonTradingDays: h,
    range: { date: end.date, low: round(end.low), middle: round(end.mid), high: round(end.high), probability: 0.8 },
    pastCoverage: result.coverage == null ? null : { share: round(result.coverage, 3), samples: result.coverageSamples },
    stats: priceStats(series),
    method: 'Log-normal random walk fitted on the last 252 daily returns. A statistical range of past volatility, not a prediction of direction.',
  }
}

function round(n, digits = 3) {
  return n == null ? null : Math.round(n * 10 ** digits) / 10 ** digits
}
