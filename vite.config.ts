import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'

/**
 * Two entries, two bundles:
 *  - index.html  the React desktop. Gated: the Worker only serves it to logged-on visitors.
 *  - login.html  the XP log-on screen. Framework-free and tiny, and it shares no code with the
 *                desktop, so its files can live under /login-assets/ (the only public path)
 *                without exposing anything from the gated bundle.
 */
const isLoginFile = (name: string | undefined) => name?.startsWith('login') ?? false

/** Members-only apps (src/apps/private) get their own folder, which the Worker refuses to Guests. */
const isPrivateModule = (id: string | null | undefined) => (id ?? '').replaceAll('\\', '/').includes('/src/apps/private/')

/** Admin-only apps (src/apps/admin, Trent's Analytics) get a folder the Worker refuses to everyone else. */
const isAdminModule = (id: string | null | undefined) => (id ?? '').replaceAll('\\', '/').includes('/src/apps/admin/')

export default defineConfig({
  plugins: [react(), cloudflare()],
  environments: {
    // Scoped to `client`: top-level build options would also reach the Worker's own build.
    client: {
      build: {
        // The polyfill would be a chunk shared by both entries, and so a gated file the login page needs.
        modulePreload: { polyfill: false },
        rollupOptions: {
          input: { main: 'index.html', login: 'login.html' },
          output: {
            chunkFileNames: (chunk) =>
              isAdminModule(chunk.facadeModuleId)
                ? 'assets/admin/[name]-[hash].js'
                : isPrivateModule(chunk.facadeModuleId)
                  ? 'assets/private/[name]-[hash].js'
                  : 'assets/[name]-[hash].js',
            entryFileNames: (chunk) =>
              isLoginFile(chunk.name) ? 'login-assets/[name]-[hash].js' : 'assets/[name]-[hash].js',
            assetFileNames: (asset) =>
              asset.names.some(isLoginFile)
                ? 'login-assets/[name]-[hash][extname]'
                : 'assets/[name]-[hash][extname]',
          },
        },
      },
    },
  },
})
