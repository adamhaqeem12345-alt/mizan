import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Plus, ShieldCheck, X } from 'lucide-react'
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import { barsApi, type HistoricalBar } from '../api/market'
import { PageHeader } from '../components/PageHeader'
import { Skeleton } from '../components/StateViews'
import { Button } from '../components/ui/button'
import { readSemanticColor } from '../theme/semanticColors'
import { useEffectivePalette, useEffectiveTheme } from '../theme/useEffectiveTheme'
import { useWorkspace } from '../tabs/store'
import { forecastRange, priceStats, type Forecast, type Stats } from '../mizan/forecast'
import {
  DEFAULT_WATCHLIST,
  SC_LIST_DATE,
  SC_LIST_STOCKS,
  findShariah,
  searchShariah,
  toYahoo,
} from '../mizan/scList'

const WATCHLIST_KEY = 'mizan.watchlist'
const HISTORY_BARS = 520 // ~2 years of trading days: 1 year to fit, 1 year to check coverage
const HORIZON = 20

function loadWatchlist(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(WATCHLIST_KEY) ?? 'null') as unknown
    if (Array.isArray(saved) && saved.every(c => typeof c === 'string')) return saved.filter(c => findShariah(c))
  } catch { /* fall through to defaults */ }
  return DEFAULT_WATCHLIST
}

function saveWatchlist(codes: string[]) {
  try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(codes)) } catch { /* private mode */ }
}

const rm = (n: number) => `RM ${n.toFixed(n < 1 ? 3 : 2)}`
const pct = (n: number | null) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`)
const toTime = (date: string) => Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000) as UTCTimestamp

// ==================== Page ====================

export function MizanHomePage() {
  const [watchlist, setWatchlist] = useState<string[]>(loadWatchlist)
  const [selected, setSelected] = useState<string>(() => loadWatchlist()[0] ?? DEFAULT_WATCHLIST[0])

  const updateWatchlist = (next: string[]) => {
    setWatchlist(next)
    saveWatchlist(next)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Mizan · Bursa Shariah"
        description={`Shariah-compliant shares only, from the SC Shariah Advisory Council list of ${SC_LIST_DATE} (${SC_LIST_STOCKS} stocks). Paper trading, cash only, no short selling.`}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 md:px-8">
        <section className="flex flex-col gap-2" aria-label="Watchlist">
          <div className="max-w-sm">
            <AddStock
              onAdd={(code) => {
                if (!watchlist.includes(code)) updateWatchlist([...watchlist, code])
                setSelected(code)
              }}
            />
          </div>
          <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
            {watchlist.map(code => (
              <WatchRow
                key={code}
                code={code}
                active={code === selected}
                onSelect={() => setSelected(code)}
                onRemove={() => {
                  const next = watchlist.filter(c => c !== code)
                  updateWatchlist(next)
                  if (selected === code && next[0]) setSelected(next[0])
                }}
              />
            ))}
          </ul>
        </section>
        <section className="flex min-w-0 flex-col gap-4 border-t border-border/60 pt-4">
          {selected ? <StockPanel code={selected} /> : <p className="text-[13px] text-muted-foreground">Add a stock to start.</p>}
        </section>
      </div>
    </div>
  )
}

// ==================== Watchlist ====================

function AddStock({ onAdd }: { onAdd: (code: string) => void }) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => searchShariah(query), [query])

  return (
    <div className="relative">
      <label className="sr-only" htmlFor="mizan-search">Add a Shariah-compliant stock</label>
      <input
        id="mizan-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Add stock: name or code"
        className="h-9 w-full rounded-lg border border-border bg-card px-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      {query && (
        <div className="absolute left-0 right-0 top-10 z-10 rounded-lg border border-border bg-popover p-1 shadow-lg">
          {results.length === 0 ? (
            <p className="px-2 py-1.5 text-[12px] text-muted-foreground">Not on the SC Shariah list</p>
          ) : results.map(s => (
            <button
              key={s.code}
              type="button"
              onClick={() => { onAdd(s.code); setQuery('') }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-secondary"
            >
              <Plus size={13} className="shrink-0 text-muted-foreground" />
              <span className="font-mono text-muted-foreground">{s.code}</span>
              <span className="truncate text-foreground">{s.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function WatchRow({ code, active, onSelect, onRemove }: {
  code: string
  active: boolean
  onSelect: () => void
  onRemove: () => void
}) {
  const bars = useBars(code, 30)
  const name = findShariah(code)?.name ?? code
  const closes = bars.data?.map(b => b.close) ?? []
  const last = closes.at(-1)
  const prev = closes.at(-2)
  const dayChange = last != null && prev ? last / prev - 1 : null

  return (
    <li className="group relative">
      <button
        type="button"
        onClick={onSelect}
        aria-current={active || undefined}
        className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left ${active ? 'border-primary/40 bg-primary/[0.06]' : 'border-transparent hover:bg-secondary'}`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-foreground">{name.replace(/ (Bhd|Berhad)$/, '')}</span>
          <span className="block font-mono text-[11px] text-muted-foreground">{code}</span>
        </span>
        <span className="text-right">
          <span className="block font-mono text-[12px] text-foreground">{last != null ? last.toFixed(2) : bars.error ? '—' : '…'}</span>
          <span className={`block font-mono text-[11px] ${dayChange == null ? 'text-muted-foreground' : dayChange >= 0 ? 'text-success' : 'text-destructive'}`}>{pct(dayChange)}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${name}`}
        className="absolute -right-1 -top-1 hidden rounded-full border border-border bg-card p-0.5 text-muted-foreground hover:text-foreground group-hover:block"
      >
        <X size={11} />
      </button>
    </li>
  )
}

// ==================== Stock panel ====================

function StockPanel({ code }: { code: string }) {
  const openOrFocus = useWorkspace((s) => s.openOrFocus)
  const security = findShariah(code)
  const bars = useBars(code, HISTORY_BARS)
  const series = useMemo(() => bars.data?.map(b => ({ date: b.date.slice(0, 10), close: b.close })) ?? [], [bars.data])
  const forecast = useMemo(() => forecastRange(series, HORIZON), [series])
  const stats = useMemo(() => priceStats(series), [series])
  const last = series.at(-1)

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[18px] font-semibold text-foreground">{security?.name ?? code}</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
              <ShieldCheck size={12} /> Shariah-compliant
            </span>
          </div>
          <p className="font-mono text-[12px] text-muted-foreground">
            {code} · {security?.market ?? 'MAIN'} Market{last ? ` · last close ${last.date}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {last && <span className="font-mono text-[22px] font-semibold text-foreground">{rm(last.close)}</span>}
          <Button
            variant="outline"
            size="sm"
            onClick={() => openOrFocus({ kind: 'market-detail', params: { assetClass: 'equity', symbol: toYahoo(code) } })}
          >
            Full chart <ArrowUpRight size={13} />
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-2">
        {bars.loading && !bars.data ? <Skeleton className="h-[360px] w-full rounded" /> : null}
        {bars.error && <p className="p-3 text-[12px] text-muted-foreground">Price data unavailable: {bars.error}</p>}
        {bars.data && <PriceChart bars={bars.data} forecast={forecast} sma50={stats.sma50} />}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ForecastCard forecast={forecast} />
        <StatsCard stats={stats} last={last?.close} />
        <RulesCard />
      </div>

      <p className="text-[11px] leading-4 text-muted-foreground">
        The forecast range is a statistical estimate from past daily price moves. It is not a recommendation to buy,
        sell or hold, and it is not investment advice. Prices from Yahoo Finance (delayed, unofficial).
      </p>
    </>
  )
}

function ForecastCard({ forecast }: { forecast: Forecast | null }) {
  if (!forecast) return <Card title={`${HORIZON}-day forecast range`}><p className="text-[12px] text-muted-foreground">Not enough history.</p></Card>
  const end = forecast.points[forecast.points.length - 1]
  return (
    <Card title={`${HORIZON}-day forecast range (80%)`}>
      <p className="font-mono text-[16px] font-semibold text-foreground">{rm(end.low)} – {rm(end.high)}</p>
      <p className="mt-1 text-[12px] text-muted-foreground">Middle estimate {rm(end.mid)} by {end.date}</p>
      <p className="mt-2 text-[12px] text-muted-foreground">
        {forecast.coverage == null
          ? 'Not enough history to check this range against past prices.'
          : `Over the past ${forecast.coverageSamples} days, this method's range held the real price ${Math.round(forecast.coverage * 100)}% of the time.`}
      </p>
    </Card>
  )
}

function StatsCard({ stats, last }: { stats: Stats; last?: number }) {
  const trend = last != null && stats.sma200 != null
    ? last >= stats.sma200 ? 'Above its 200-day average' : 'Below its 200-day average'
    : null
  return (
    <Card title="Price history">
      <dl className="grid grid-cols-3 gap-2 text-[12px]">
        {([['1M', stats.change1m], ['3M', stats.change3m], ['1Y', stats.change1y]] as const).map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className={`font-mono ${value == null ? 'text-muted-foreground' : value >= 0 ? 'text-success' : 'text-destructive'}`}>{pct(value)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[12px] text-muted-foreground">
        Volatility {stats.volatility == null ? '—' : `${(stats.volatility * 100).toFixed(0)}% a year`}{trend ? ` · ${trend}` : ''}
      </p>
    </Card>
  )
}

function RulesCard() {
  return (
    <Card title="Trading rules">
      <ul className="space-y-1 text-[12px] text-muted-foreground">
        <li>Ordinary shares on the SC list only</li>
        <li>Cash only, no margin</li>
        <li>No short selling</li>
        <li>No forex, gold, crypto or derivatives</li>
        <li>You approve every trade</li>
      </ul>
    </Card>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <h3 className="mb-1.5 text-[12px] font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  )
}

// ==================== Chart ====================

function PriceChart({ bars, forecast, sma50 }: { bars: HistoricalBar[]; forecast: Forecast | null; sma50: number | null }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const theme = useEffectiveTheme()
  const palette = useEffectivePalette()

  useEffect(() => {
    if (!containerRef.current) return
    const colors = {
      text: readSemanticColor('chart-axis'),
      grid: readSemanticColor('chart-grid'),
      positive: readSemanticColor('chart-positive'),
      negative: readSemanticColor('chart-negative'),
      primary: readSemanticColor('primary'),
      muted: readSemanticColor('primary-muted'),
    }
    const chart = createChart(containerRef.current, {
      layout: { background: { color: 'transparent' }, textColor: colors.text },
      grid: { vertLines: { color: colors.grid }, horzLines: { color: colors.grid } },
      rightPriceScale: { borderColor: colors.grid },
      timeScale: { borderColor: colors.grid },
      autoSize: true,
    })
    chartRef.current = chart

    const daily = bars.map(b => ({ ...b, date: b.date.slice(0, 10) }))
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: colors.positive, downColor: colors.negative,
      borderUpColor: colors.positive, borderDownColor: colors.negative,
      wickUpColor: colors.positive, wickDownColor: colors.negative,
    })
    candles.setData(daily.map(b => ({ time: toTime(b.date), open: b.open, high: b.high, low: b.low, close: b.close })))

    if (sma50 != null && daily.length >= 50) {
      const avg = chart.addSeries(LineSeries, { color: colors.muted, lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
      const closes = daily.map(b => b.close)
      avg.setData(daily.slice(49).map((b, i) => ({
        time: toTime(b.date),
        value: closes.slice(i, i + 50).reduce((a, c) => a + c, 0) / 50,
      })))
    }

    if (forecast) {
      const start = { time: toTime(forecast.last.date), value: forecast.last.close }
      const line = (key: 'low' | 'mid' | 'high', style: LineStyle) => {
        const s = chart.addSeries(LineSeries, { color: colors.primary, lineWidth: key === 'mid' ? 2 : 1, lineStyle: style, priceLineVisible: false, lastValueVisible: key !== 'mid' })
        s.setData([start, ...forecast.points.map(p => ({ time: toTime(p.date), value: p[key] }))])
      }
      line('high', LineStyle.Dashed)
      line('mid', LineStyle.Dotted)
      line('low', LineStyle.Dashed)
    }

    // Show the last year plus the forecast window.
    const from = daily[Math.max(0, daily.length - 252)]
    const to = forecast?.points.at(-1)?.date ?? daily.at(-1)?.date
    if (from && to) chart.timeScale().setVisibleRange({ from: toTime(from.date), to: toTime(to) })

    return () => { chart.remove(); chartRef.current = null }
  }, [bars, forecast, sma50, theme, palette])

  return <div ref={containerRef} className="h-[360px] w-full" aria-label="Price chart with forecast range" role="img" />
}

// ==================== Data ====================

function useBars(code: string, count: number) {
  const [state, setState] = useState<{ data: HistoricalBar[] | null; loading: boolean; error: string | null }>({ data: null, loading: true, error: null })

  useEffect(() => {
    let alive = true
    setState({ data: null, loading: true, error: null })
    barsApi.bars({ symbol: toYahoo(code), assetClass: 'equity', interval: '1d', count })
      .then(res => {
        if (!alive) return
        const data = res.results
        setState({ data, loading: false, error: data && data.length ? null : 'no data' })
      })
      .catch(err => { if (alive) setState({ data: null, loading: false, error: err instanceof Error ? err.message : 'failed' }) })
    return () => { alive = false }
  }, [code, count])

  return state
}
