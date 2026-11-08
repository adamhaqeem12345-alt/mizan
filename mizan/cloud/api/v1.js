// Mizan public API (mizan.api.cuddleia.com). Read-only JSON; vercel.json rewrites
// /v1/<route> to /api/v1?route=<route>.
import { DISCLAIMER, SOURCE, forecast, listInfo, priceHistory, searchStocks, shariahStatus } from '../lib/mizan.js'

const DAY = 'public, s-maxage=86400, stale-while-revalidate=604800'
const HOUR = 'public, s-maxage=3600, stale-while-revalidate=86400'

export const ENDPOINTS = {
  'GET /v1/list': 'SC Shariah list info: date, counts, next expected update',
  'GET /v1/shariah/{code}': 'Shariah status of one Bursa stock code, e.g. /v1/shariah/5347',
  'GET /v1/stocks?q={text}&limit={n}': 'Search Shariah-compliant stocks by code or name',
  'GET /v1/prices/{code}?days={n}': 'Daily price history (Yahoo Finance, delayed), up to 1300 days',
  'GET /v1/forecast/{code}?horizon={days}': '80% price range over 5–60 trading days, with its past hit rate',
}

function json(body, status = 200, cache = DAY) {
  return Response.json(body, {
    status,
    headers: { 'cache-control': status === 200 ? cache : 'no-store', 'access-control-allow-origin': '*' },
  })
}

export async function GET(request) {
  const url = new URL(request.url)
  const route = (url.searchParams.get('route') ?? '').replace(/^\/+|\/+$/g, '')
  const [name, arg] = route.split('/')
  try {
    switch (name) {
      case '':
        return json({ name: 'Mizan API', version: 1, endpoints: ENDPOINTS, mcp: 'https://mizan.mcp.cuddleia.com/mcp', source: SOURCE, disclaimer: DISCLAIMER })
      case 'list':
        return json({ ...listInfo(), disclaimer: DISCLAIMER })
      case 'shariah': {
        const result = shariahStatus(arg)
        return json({ ...result, disclaimer: DISCLAIMER }, result.error ? 400 : 200)
      }
      case 'stocks':
        return json({ query: url.searchParams.get('q') ?? '', results: searchStocks(url.searchParams.get('q'), url.searchParams.get('limit')) })
      case 'prices': {
        const result = await priceHistory(arg, url.searchParams.get('days'))
        return json({ ...result, disclaimer: DISCLAIMER }, result.error ? 400 : 200, HOUR)
      }
      case 'forecast': {
        const result = await forecast(arg, url.searchParams.get('horizon'))
        return json({ ...result, disclaimer: DISCLAIMER }, result.error ? 400 : 200, HOUR)
      }
      default:
        return json({ error: `Unknown endpoint /v1/${route}`, endpoints: ENDPOINTS }, 404)
    }
  } catch (err) {
    return json({ error: 'Price source unavailable, try again later', detail: err instanceof Error ? err.message : String(err) }, 502)
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS' } })
}
