import { test } from 'node:test'
import assert from 'node:assert/strict'
import { listInfo, nextListUpdate, normaliseCode, searchStocks, shariahStatus } from '../lib/mizan.js'
import { GET as api } from '../api/v1.js'
import { POST as mcp } from '../api/mcp.js'

test('codes are normalised and validated', () => {
  assert.equal(normaliseCode(' 5347.kl '), '5347')
  assert.equal(normaliseCode('MAYBANK'), null)
})

test('Shariah status comes from the SC list', () => {
  assert.equal(shariahStatus('5258').shariahCompliant, true)      // Bank Islam
  assert.equal(shariahStatus('1155').shariahCompliant, false)     // Maybank
  assert.ok(shariahStatus('abc').error)
})

test('search finds listed stocks only', () => {
  const r = searchStocks('tenaga', 5)
  assert.ok(r.some(s => s.code === '5347'))
  assert.equal(searchStocks('malayan banking').length, 0)
})

test('next SC list update is the last Friday of November 2026', () => {
  assert.equal(nextListUpdate('2026-05-29'), '2026-11-27')
  assert.equal(listInfo().stocks, 886)
})

const call = (route) => api(new Request(`http://x/api/v1?route=${encodeURIComponent(route)}`))

test('API routes', async () => {
  const index = await (await call('')).json()
  assert.equal(index.name, 'Mizan API')
  const s = await call('shariah/5347')
  assert.equal(s.status, 200)
  assert.equal((await s.json()).shariahCompliant, true)
  assert.equal((await call('shariah/xyz')).status, 400)
  assert.equal((await call('nope')).status, 404)
  const stocks = await (await api(new Request('http://x/api/v1?route=stocks&q=bank%20islam'))).json()
  assert.ok(stocks.results.some(r => r.code === '5258'))
})

async function rpc(method, params, id = 1) {
  const res = await mcp(new Request('http://x/api/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  }))
  assert.equal(res.status, 200, await res.clone().text())
  return res.json()
}

test('MCP initialize, list tools, call a tool', async () => {
  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } })
  assert.equal(init.result.serverInfo.name, 'mizan')
  assert.match(init.result.instructions, /never tell the user to buy, sell or hold/)

  const tools = await rpc('tools/list', {}, 2)
  assert.deepEqual(tools.result.tools.map(t => t.name).sort(),
    ['check_shariah_status', 'get_forecast_range', 'get_price_history', 'get_sc_list_info', 'search_shariah_stocks'])

  const called = await rpc('tools/call', { name: 'check_shariah_status', arguments: { code: '1155' } }, 3)
  const body = JSON.parse(called.result.content[0].text)
  assert.equal(body.shariahCompliant, false)
  assert.match(body.disclaimer, /not investment advice/)
})

test('catalogs list the Mizan endpoints', async () => {
  const { GET: catalog } = await import('../api/catalog.js')
  const { GET: mcpInfo } = await import('../api/mcp-info.js')
  assert.equal((await catalog().json()).products.mizan.api, 'https://api.cuddleia.com/mizan/v1')
  assert.equal((await mcpInfo().json()).servers.mizan.endpoint, 'https://mcp.cuddleia.com/mizan')
})
