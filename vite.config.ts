import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const ENGINE_FILES = ['engine/stockfish-19-lite-single.js', 'engine/stockfish-19-lite-single.wasm']

// Erzeugt einen kleinen Service Worker, der alle Build-Dateien vorab cached,
// damit die App offline und vom Homescreen aus funktioniert. Die Engine liegt
// in einem eigenen Cache, damit sie nicht bei jedem Update neu geladen wird.
function serviceWorker(): Plugin {
  return {
    name: 'schach-sw',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter((f) => f !== 'index.html')
      const assets = ['./', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon.svg', 'apple-touch-icon.png', ...files]
      const source = `const CACHE = 'schach-${Date.now()}'
const ENGINE = 'schach-engine-19-lite-single'
const ASSETS = ${JSON.stringify(assets)}
const ENGINE_FILES = ${JSON.stringify(ENGINE_FILES)}
const OPTS = { ignoreSearch: true, ignoreVary: true }
self.addEventListener('install', (e) => {
  e.waitUntil(
    Promise.all([
      caches.open(CACHE).then((c) => c.addAll(ASSETS)),
      caches.open(ENGINE).then((c) => c.keys().then((k) => (k.length >= ENGINE_FILES.length ? null : c.addAll(ENGINE_FILES)))),
    ]).then(() => self.skipWaiting()),
  )
})
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== ENGINE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return
  e.respondWith(
    caches.match(req, OPTS).then(
      (hit) => hit || fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('./', OPTS) : Response.error())),
    ),
  )
})
`
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1500 },
  plugins: [react(), serviceWorker()],
})
