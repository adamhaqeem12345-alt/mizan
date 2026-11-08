// https://mcp.cuddleia.com/ : the list of Cuddleia MCP servers. Each server lives under its own path.
export function GET() {
  return Response.json({
    name: 'Cuddleia MCP servers',
    transport: 'Streamable HTTP (stateless, JSON responses)',
    servers: {
      mizan: {
        endpoint: 'https://mcp.cuddleia.com/mizan',
        auth: 'none (public, read-only)',
        tools: ['check_shariah_status', 'search_shariah_stocks', 'get_price_history', 'get_forecast_range', 'get_sc_list_info'],
        connect: {
          claudeCode: 'claude mcp add --transport http mizan https://mcp.cuddleia.com/mizan',
          other: 'Add a remote MCP server with the endpoint URL in your AI app.',
        },
        api: 'https://api.cuddleia.com/mizan/v1',
        source: 'https://github.com/adamhaqeem12345-alt/mizan',
        disclaimer: 'Demo and learning tool. Not investment advice.',
      },
    },
  }, { headers: { 'cache-control': 'public, s-maxage=86400' } })
}
