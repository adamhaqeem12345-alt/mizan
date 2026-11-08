// Mizan MCP server (mizan.mcp.cuddleia.com/mcp). Stateless Streamable HTTP:
// each request gets a fresh server, so it runs as a plain serverless function.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { z } from 'zod'
import { DISCLAIMER, forecast, listInfo, priceHistory, searchStocks, shariahStatus } from '../lib/mizan.js'

const INSTRUCTIONS = [
  'Mizan checks Bursa Malaysia stocks against the Securities Commission Malaysia Shariah Advisory Council list,',
  'and gives daily prices and a statistical 80% price range.',
  'Rules for using these tools:',
  '- Explain; never tell the user to buy, sell or hold a stock, and never promise returns.',
  '  In Malaysia, investment recommendations need a licence and a disclaimer does not change that.',
  '- Present forecasts as ranges together with their past hit rate, never as a direction.',
  '- Shariah status comes only from the SC list; do not judge compliance yourself.',
  '- Prices are delayed and unofficial.',
].join('\n')

function result(data) {
  const body = Array.isArray(data) ? { results: data } : data
  return {
    content: [{ type: 'text', text: JSON.stringify({ ...body, disclaimer: DISCLAIMER }, null, 2) }],
    isError: Boolean(body.error),
  }
}

function createServer() {
  const server = new McpServer({ name: 'mizan', version: '1.0.0' }, { instructions: INSTRUCTIONS })
  const readOnly = { readOnlyHint: true, openWorldHint: true }

  server.registerTool('check_shariah_status', {
    title: 'Check Shariah status',
    description: 'Check whether a Bursa Malaysia stock code (e.g. 5347 or 5347.KL) is on the SC Shariah-compliant list.',
    inputSchema: { code: z.string().describe('Bursa stock code, e.g. 5347') },
    annotations: { ...readOnly, openWorldHint: false },
  }, async ({ code }) => result(shariahStatus(code)))

  server.registerTool('search_shariah_stocks', {
    title: 'Search Shariah-compliant stocks',
    description: 'Search the SC Shariah-compliant list by company name or code prefix. Only listed (compliant) stocks are returned.',
    inputSchema: {
      query: z.string().min(1).describe('Name or code, e.g. "tenaga" or "52"'),
      limit: z.number().int().min(1).max(50).optional().describe('Maximum results (default 10)'),
    },
    annotations: { ...readOnly, openWorldHint: false },
  }, async ({ query, limit }) => result(searchStocks(query, limit)))

  server.registerTool('get_price_history', {
    title: 'Get price history',
    description: 'Daily open/high/low/close/volume for a Bursa stock (Yahoo Finance, delayed and unofficial).',
    inputSchema: {
      code: z.string().describe('Bursa stock code, e.g. 5347'),
      days: z.number().int().min(5).max(1300).optional().describe('Trading days of history (default 260)'),
    },
    annotations: readOnly,
  }, async ({ code, days }) => result(await priceHistory(code, days)))

  server.registerTool('get_forecast_range', {
    title: 'Get forecast range',
    description: 'Statistical 80% price range for the coming trading days, with how often this method held over the past year. Not a prediction of direction and not advice.',
    inputSchema: {
      code: z.string().describe('Bursa stock code, e.g. 5347'),
      horizon: z.number().int().min(5).max(60).optional().describe('Trading days ahead (default 20)'),
    },
    annotations: readOnly,
  }, async ({ code, horizon }) => result(await forecast(code, horizon)))

  server.registerTool('get_sc_list_info', {
    title: 'SC Shariah list info',
    description: 'Date and size of the SC Shariah-compliant list in use, and when the next update is expected.',
    inputSchema: {},
    annotations: { ...readOnly, openWorldHint: false },
  }, async () => result(listInfo()))

  return server
}

async function handle(request) {
  const server = createServer()
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  await server.connect(transport)
  try {
    return await transport.handleRequest(request)
  } finally {
    await server.close()
  }
}

export const POST = handle
export const GET = handle
export const DELETE = handle
