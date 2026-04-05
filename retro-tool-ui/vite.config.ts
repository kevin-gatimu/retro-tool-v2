import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tsconfigPaths from 'vite-tsconfig-paths'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  plugins: [
    devtools(),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routeFileIgnorePattern: '(hooks|helpers|types|components)',
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
