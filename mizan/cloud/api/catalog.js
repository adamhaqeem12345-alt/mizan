// https://api.cuddleia.com/ : the list of Cuddleia APIs. Each product lives under its own path.
export function GET() {
  return Response.json({
    name: 'Cuddleia API',
    products: {
      mizan: {
        description: 'Shariah-compliant Bursa Malaysia data: SC Shariah list, prices, forecast ranges',
        api: 'https://api.cuddleia.com/mizan/v1',
        mcp: 'https://mcp.cuddleia.com/mizan',
        app: 'https://mizan.cuddleia.com',
      },
    },
    contact: 'https://cuddleia.com',
  }, { headers: { 'cache-control': 'public, s-maxage=86400', 'access-control-allow-origin': '*' } })
}
