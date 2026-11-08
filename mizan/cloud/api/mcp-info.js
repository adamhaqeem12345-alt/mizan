// Landing response for https://mizan.mcp.cuddleia.com/ (the MCP endpoint itself is /mcp).
export function GET() {
  return Response.json({
    name: 'Mizan MCP server',
    endpoint: 'https://mizan.mcp.cuddleia.com/mcp',
    transport: 'Streamable HTTP (stateless, JSON responses)',
    auth: 'none (public, read-only)',
    tools: ['check_shariah_status', 'search_shariah_stocks', 'get_price_history', 'get_forecast_range', 'get_sc_list_info'],
    connect: {
      claudeCode: 'claude mcp add --transport http mizan https://mizan.mcp.cuddleia.com/mcp',
      other: 'Add a remote MCP server with the URL above in your AI app.',
    },
    api: 'https://mizan.api.cuddleia.com',
    source: 'https://github.com/adamhaqeem12345-alt/mizan',
    disclaimer: 'Demo and learning tool. Not investment advice.',
  }, { headers: { 'cache-control': 'public, s-maxage=86400' } })
}
