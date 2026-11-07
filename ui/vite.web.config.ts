import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

/**
 * Mizan web build (mizan.cuddleia.com): the Bursa Shariah dashboard and a
 * browser-only paper account, with no OpenAlice backend. On Vercel, /api/bars
 * is the function in ../api/bars.js; in `vite dev` this plugin serves it.
 */
function barsApi(): Plugin {
  return {
    name: 'mizan-bars-api',
    configureServer(server) {
      server.middlewares.use('/api/bars', async (req, res) => {
        const { GET } = await import('../api/bars.js')
        const response: Response = await GET(new Request(`http://localhost/api/bars${req.url ?? ''}`))
        res.statusCode = response.status
        res.setHeader('content-type', 'application/json')
        res.end(await response.text())
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), barsApi()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  publicDir: 'web-public',
  server: { host: '127.0.0.1', port: 5180 },
  build: {
    outDir: 'dist-web',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: { input: resolve(__dirname, 'web.html') },
  },
})
