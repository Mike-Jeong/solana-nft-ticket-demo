import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'process', 'util', 'events', 'stream', 'path', 'crypto'],
      globals: { Buffer: true, process: true },
    }),
  ],
  base: '/',
  resolve: {
    alias: {
      'process/browser': path.resolve(__dirname, 'node_modules/process/browser.js'),
      process: path.resolve(__dirname, 'node_modules/process/browser.js'),
      buffer: 'buffer',
      stream: 'stream-browserify',
      path: 'path-browserify',
      crypto: 'crypto-browserify',
      util: 'util',
      events: 'events',
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: { global: 'globalThis' },
    },
  },
})