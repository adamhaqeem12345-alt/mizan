# Mizan cloud: public API and MCP server

Read-only services built on the same data and maths as the Mizan dashboard.

| | URL |
|---|---|
| API | https://api.cuddleia.com/mizan/v1 |
| MCP | https://mcp.cuddleia.com/mizan |

Cuddleia keeps one subdomain per kind of service and one path per product:
`api.cuddleia.com/<product>/v1/...` and `mcp.cuddleia.com/<product>`. The roots
list the available products. The old `mizan.api.cuddleia.com` and
`mizan.mcp.cuddleia.com` addresses redirect (308) to the new ones.

## API

| Endpoint | Returns |
|---|---|
| `GET /mizan/v1/list` | SC Shariah list date, counts, next expected update |
| `GET /mizan/v1/shariah/{code}` | Shariah status of a Bursa code, e.g. `/mizan/v1/shariah/5347` |
| `GET /mizan/v1/stocks?q=&limit=` | Search Shariah-compliant stocks by name or code |
| `GET /mizan/v1/prices/{code}?days=` | Daily prices (Yahoo Finance, delayed), up to 1300 days |
| `GET /mizan/v1/forecast/{code}?horizon=` | 80% price range over 5–60 trading days, with its past hit rate |

Responses are JSON, CORS-open and cached at the edge (list data for a day,
prices for an hour).

## MCP

Stateless Streamable HTTP with JSON responses, no sign-in. Tools:
`check_shariah_status`, `search_shariah_stocks`, `get_price_history`,
`get_forecast_range`, `get_sc_list_info`. The server's instructions tell the
model to explain and never give buy, sell or hold advice.

```bash
claude mcp add --transport http mizan https://mcp.cuddleia.com/mizan
```

## Development

```bash
npm ci
npm test              # API routes and an MCP handshake
npm run sync          # refresh lib/ from the dashboard code and SC list
```

`lib/forecast.js`, `lib/bars.js` and `lib/sc-list.json` are generated copies of
`ui/src/mizan/forecast.ts`, `api/bars.js` and the SC list in `mizan/data/`.
The Vercel build runs `sync --check` and reports stale copies. After updating
the SC list, change `SC_LIST` in `scripts/sync.mjs` and run `npm run sync`.

Deployed as the Vercel project `mizan-cloud` with this folder as its root.
Not investment advice.
