import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

// Dedicated Vitest config: jsdom + a shared setup file that installs the
// browser API mocks (matchMedia, ResizeObserver, IntersectionObserver) that
// Radix/shadcn components touch on mount. Kept separate from vite.config.ts so
// the TanStack Router plugin's route-tree generation doesn't run under test.
export default defineConfig({
  plugins: [tsconfigPaths({ projects: ['./tsconfig.json'] }), viteReact()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // src/env.ts validates required client vars (e.g. VITE_API_URL) at import
    // time via @t3-oss/env-core. Tests that transitively import lib/api need a
    // valid value; CI has no .env, so supply a dummy here (populates
    // import.meta.env). Other client vars have defaults/are optional.
    env: {
      VITE_API_URL: 'http://localhost:8000',
    },
  },
})
