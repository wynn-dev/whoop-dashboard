import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // Visx's alpha ESM packages contain extensionless imports; Vite resolves
  // them correctly when they remain in the SSR bundle.
  ssr: { noExternal: [/^@visx\//] },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    nitro({
      // Local builds target a plain Node server. On Vercel (or with
      // NITRO_PRESET set) Nitro writes that platform's output instead.
      preset:
        process.env.NITRO_PRESET ??
        (process.env.VERCEL ? 'vercel' : 'node-server'),
      vercel: {
        // A 90-day reconcile pages through four WHOOP collections with a
        // rate-limit pause between pages, so it outlives a short default.
        functionRules: {
          '/api/sync': { maxDuration: 'max' },
          '/api/mcp': { maxDuration: 'max' },
        },
      },
    }),
    react(),
  ],
})
