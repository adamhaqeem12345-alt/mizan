/**
 * Mizan forecast: a statistical price range, not a prediction of direction.
 *
 * Daily log returns from the lookback window give a mean (drift) and
 * standard deviation. Prices are projected as a log-normal random walk, so
 * the band widens with the square root of time. `coverage` reports how often
 * this same method's 80% band actually contained the price `horizon` days
 * later over recent history, so the range can be judged honestly.
 */

export interface Bar {
  date: string
  close: number
}

export interface ForecastPoint {
  date: string
  low: number
  mid: number
  high: number
}

export interface Forecast {
  last: Bar
  horizon: number
  points: ForecastPoint[]
  /** Share of past windows where the price landed inside the band (0–1), or null if history is short. */
  coverage: number | null
  coverageSamples: number
}

export interface Stats {
  change1m: number | null
  change3m: number | null
  change1y: number | null
  /** Annualised volatility of daily log returns. */
  volatility: number | null
  sma50: number | null
  sma200: number | null
}

/** z-score for a central 80% band (10th to 90th percentile). */
const Z80 = 1.2815515655446004
const TRADING_DAYS = 252

export function logReturns(closes: number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0 && closes[i] > 0) out.push(Math.log(closes[i] / closes[i - 1]))
  }
  return out
}

function meanStd(xs: number[]): { mean: number; std: number } {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, xs.length - 1)
  return { mean, std: Math.sqrt(variance) }
}

function band(price: number, mean: number, std: number, h: number) {
  const center = mean * h
  const spread = Z80 * std * Math.sqrt(h)
  return { low: price * Math.exp(center - spread), mid: price * Math.exp(center), high: price * Math.exp(center + spread) }
}

/** Next `n` weekdays after `date` (YYYY-MM-DD). Bursa public holidays are not excluded. */
export function nextWeekdays(date: string, n: number): string[] {
  const out: string[] = []
  const d = new Date(`${date}T00:00:00Z`)
  while (out.length < n) {
    d.setUTCDate(d.getUTCDate() + 1)
    const day = d.getUTCDay()
    if (day !== 0 && day !== 6) out.push(d.toISOString().slice(0, 10))
  }
  return out
}

export function forecastRange(bars: Bar[], horizon = 20, lookback = TRADING_DAYS): Forecast | null {
  const clean = bars.filter(b => Number.isFinite(b.close) && b.close > 0)
  if (clean.length < 60) return null

  const closes = clean.map(b => b.close)
  const { mean, std } = meanStd(logReturns(closes.slice(-(lookback + 1))))
  const last = clean[clean.length - 1]
  const dates = nextWeekdays(last.date, horizon)
  const points = dates.map((date, i) => ({ date, ...band(last.close, mean, std, i + 1) }))

  // Walk-forward check: fit on each past window, test the price `horizon` days on.
  let hits = 0
  let samples = 0
  for (let t = lookback; t + horizon < closes.length; t++) {
    const fit = meanStd(logReturns(closes.slice(t - lookback, t + 1)))
    const b = band(closes[t], fit.mean, fit.std, horizon)
    const actual = closes[t + horizon]
    if (actual >= b.low && actual <= b.high) hits++
    samples++
  }

  return { last, horizon, points, coverage: samples > 0 ? hits / samples : null, coverageSamples: samples }
}

function change(closes: number[], days: number): number | null {
  if (closes.length <= days) return null
  const from = closes[closes.length - 1 - days]
  return from > 0 ? closes[closes.length - 1] / from - 1 : null
}

function sma(closes: number[], n: number): number | null {
  if (closes.length < n) return null
  return closes.slice(-n).reduce((a, b) => a + b, 0) / n
}

export function priceStats(bars: Bar[]): Stats {
  const closes = bars.map(b => b.close).filter(c => Number.isFinite(c) && c > 0)
  const returns = logReturns(closes.slice(-(TRADING_DAYS + 1)))
  return {
    change1m: change(closes, 21),
    change3m: change(closes, 63),
    change1y: change(closes, TRADING_DAYS),
    volatility: returns.length >= 20 ? meanStd(returns).std * Math.sqrt(TRADING_DAYS) : null,
    sma50: sma(closes, 50),
    sma200: sma(closes, 200),
  }
}
