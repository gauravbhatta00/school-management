import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // 127.0.0.1, not localhost: Django's runserver binds to the IPv4 loopback
  // only, but Node resolves "localhost" to the IPv6 loopback (::1) first on
  // many systems, which makes the proxy connection fail intermittently.
  const apiTarget = env.VITE_API_TARGET || 'http://127.0.0.1:8000'
  const devPort = Number(env.VITE_PORT || 5173)

  return {
    plugins: [react()],
    // The desktop build is loaded by Electron via file://, where absolute
    // asset paths ("/assets/...", Vite's default) resolve against the
    // filesystem root instead of the html file's own directory. Relative
    // paths work under file:// and are equally valid for normal http(s)
    // serving, but this is scoped to the desktop build only to avoid any
    // behavior change for the deployed web app.
    base: mode === 'desktop' ? './' : '/',
    server: {
      // Same IPv4-vs-IPv6 reasoning as apiTarget above: bind explicitly to
      // 127.0.0.1 so the dev server's actual address always matches the
      // origin used in CORS config (backend/config/settings/desktop.py)
      // and the one Electron's main process probes on startup.
      host: '127.0.0.1',
      port: devPort,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.js',
    },
  }
})
