import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Erzeugt einen kleinen Service Worker, der alle Build-Dateien vorab cached,
// damit die App offline und vom Homescreen aus funktioniert.
function serviceWorker(): Plugin {
  return {
    name: 'schach-sw',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter((f) => f !== 'index.html')
      const assets = ['./', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon.svg', 'apple-touch-icon.png', ...files]
      const source = `const CACHE = 'schach-${Date.now()}'
const ASSETS = ${JSON.stringify(assets)}
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return
  e.respondWith(
    caches.match(req, { ignoreSearch: true, ignoreVary: true }).then(
      (hit) => hit || fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('./', { ignoreVary: true }) : Response.error())),
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
  plugins: [react(), serviceWorker()],
})
