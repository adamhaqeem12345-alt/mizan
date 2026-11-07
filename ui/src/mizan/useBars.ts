import { useEffect, useState } from 'react'
import { barsApi, type HistoricalBar } from '../api/market'
import { toYahoo } from './scList'

/** Daily bars for a Bursa stock code, newest last. */
export function useBars(code: string, count: number) {
  const [state, setState] = useState<{ data: HistoricalBar[] | null; loading: boolean; error: string | null }>({ data: null, loading: true, error: null })

  useEffect(() => {
    let alive = true
    setState({ data: null, loading: true, error: null })
    barsApi.bars({ symbol: toYahoo(code), assetClass: 'equity', interval: '1d', count })
      .then(res => {
        if (!alive) return
        const data = res.results
        setState({ data, loading: false, error: data && data.length ? null : (res.error ?? 'no data') })
      })
      .catch(err => { if (alive) setState({ data: null, loading: false, error: err instanceof Error ? err.message : 'failed' }) })
    return () => { alive = false }
  }, [code, count])

  return state
}
