import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tsconfigPaths from 'vite-tsconfig-paths'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }

const config = defineConfig({
  // CI injects VITE_APP_VERSION from the release-please-managed package.json;
  // local builds fall back to the version field directly.
  define: {
    __APP_VERSION__: JSON.stringify(
      process.env.VITE_APP_VERSION ?? `v${packageJson.version}`,
    ),
  },
  plugins: [
    devtools(),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routeFileIgnorePattern: '(hooks|helpers|types|components|skeleton)',
    }),
    viteReact({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 700, // Increase chunk size warning limit to 1MB
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Recharts (large charting library)
          if (id.includes('recharts')) {
            return 'recharts'
          }

          // Radix UI - group all radix packages
          if (id.includes('@radix-ui/')) {
            return 'radix-ui'
          }

          // Socket.io
          if (id.includes('socket.io-client')) {
            return 'socket-io'
          }

          // Lucide icons
          if (id.includes('lucide-react')) {
            return 'icons'
          }
        },
      },
    },
  },
})

export default config
