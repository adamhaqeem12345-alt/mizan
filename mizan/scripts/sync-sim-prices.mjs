#!/usr/bin/env node
// Mizan: copy the latest Bursa closing prices (Yahoo .KL, via the local
// Alice API) into the simulator account, so paper trades fill at real prices.
//
// Usage (dev stack running):
//   node mizan/scripts/sync-sim-prices.mjs [code ...]
// With no codes, the default dashboard watchlist plus Maybank (1155, not
// Shariah-compliant, kept for guard demos) is synced.
//
// Env: MIZAN_URL (default http://localhost:47331), MIZAN_UTA (default: first simulator account).

const BASE = process.env.MIZAN_URL ?? 'http://localhost:47331'
const DEFAULT_CODES = ['5347', '5258', '1818', '5225', '6947', '5681', '5183', '5285', '8869', '0166', '5398', '7084', '1155']

async function json(path, init) {
  const res = await fetch(`${BASE}${path}`, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${path}: ${res.status} ${JSON.stringify(body)}`)
  return body
}

const codes = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_CODES
const utaId = process.env.MIZAN_UTA ?? (await json('/api/simulator/utas')).utas[0]?.id
if (!utaId) throw new Error('No simulator account found. Create one under Settings → Developer → Simulator.')

let failed = 0
for (const code of codes) {
  try {
    const bars = await json(`/api/bars?interval=1d&assetClass=equity&count=5&symbol=${encodeURIComponent(`${code}.KL`)}`)
    const last = bars.results?.at(-1)
    if (!last) throw new Error('no bars')
    await json(`/api/simulator/uta/${utaId}/mark-price`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nativeKey: code, price: last.close.toFixed(3) }),
    })
    console.log(`${code}\t${last.close.toFixed(3)}\t(${last.date.slice(0, 10)})`)
  } catch (err) {
    failed++
    console.error(`${code}\tfailed: ${err.message}`)
  }
}
process.exit(failed ? 1 : 0)
