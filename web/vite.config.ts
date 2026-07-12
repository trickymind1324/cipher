import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Catalyst Web Client Hosting serves the SPA under /app/, and the build output
// must land in the `client/` dir that catalyst.json points at. `emptyOutDir` stays
// false so the committed client-package.json survives a rebuild.
export default defineConfig({
  plugins: [react()],
  base: '/app/',
  build: {
    outDir: '../client',
    emptyOutDir: false,
  },
  server: {
    port: 5180,
    proxy: {
      // `catalyst serve --http 4200` — 3000 is taken by another project.
      '/server': 'http://localhost:4200',
    },
  },
})
