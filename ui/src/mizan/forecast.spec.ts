import { describe, expect, it } from 'vitest'
import { forecastRange, logReturns, nextWeekdays, priceStats, type Bar } from './forecast'

function series(closes: number[], start = '2025-01-01'): Bar[] {
  const dates = nextWeekdays(start, closes.length)
  return closes.map((close, i) => ({ date: dates[i], close }))
}

/** Deterministic noisy walk so tests do not depend on Math.random. */
function walk(n: number, drift = 0, amp = 0.01): number[] {
  const out = [10]
  for (let i = 1; i < n; i++) out.push(out[i - 1] * Math.exp(drift + amp * Math.sin(i * 1.7) * Math.cos(i * 0.31)))
  return out
}

describe('nextWeekdays', () => {
  it('skips weekends', () => {
    // 2026-11-06 is a Friday.
    expect(nextWeekdays('2026-11-06', 3)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11'])
  })
})

describe('logReturns', () => {
  it('ignores non-positive prices', () => {
    expect(logReturns([10, 0, 10, 20])).toEqual([Math.log(2)])
  })
})

describe('forecastRange', () => {
  it('needs at least 60 bars', () => {
    expect(forecastRange(series(walk(59)))).toBeNull()
  })

  it('projects a widening band around the last close', () => {
    const f = forecastRange(series(walk(300)), 20)!
    expect(f.points).toHaveLength(20)
    const first = f.points[0]
    const lastPoint = f.points[19]
    expect(first.low).toBeLessThan(f.last.close)
    expect(first.high).toBeGreaterThan(f.last.close)
    expect(lastPoint.high - lastPoint.low).toBeGreaterThan(first.high - first.low)
  })

  it('collapses to a line for a flat price', () => {
    const f = forecastRange(series(Array(120).fill(5)), 5)!
    expect(f.points[4]).toMatchObject({ low: 5, mid: 5, high: 5 })
  })

  it('reports walk-forward coverage once history is long enough', () => {
    const f = forecastRange(series(walk(320)), 20)!
    expect(f.coverageSamples).toBe(320 - 252 - 20)
    expect(f.coverage).toBeGreaterThanOrEqual(0)
    expect(f.coverage).toBeLessThanOrEqual(1)
    expect(forecastRange(series(walk(200)), 20)!.coverage).toBeNull()
  })
})

describe('priceStats', () => {
  it('computes changes and moving averages', () => {
    const closes = Array.from({ length: 260 }, (_, i) => 10 + i * 0.1)
    const s = priceStats(series(closes))
    expect(s.change1m).toBeCloseTo(closes[259] / closes[259 - 21] - 1)
    expect(s.sma50).toBeCloseTo(closes.slice(-50).reduce((a, b) => a + b) / 50)
    expect(s.sma200).not.toBeNull()
    expect(s.volatility).toBeGreaterThan(0)
  })

  it('returns nulls for short history', () => {
    const s = priceStats(series([1, 2, 3]))
    expect(s).toMatchObject({ change1m: null, change1y: null, volatility: null, sma50: null })
  })
})
