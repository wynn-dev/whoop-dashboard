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
    nitro({ preset: 'node-server' }),
    react(),
  ],
})
