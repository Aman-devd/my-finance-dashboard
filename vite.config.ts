import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { writeFileSync, mkdirSync } from 'node:fs'

const buildTs = Date.now()

export default defineConfig({
  base: '/my-finance-dashboard/',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'inject-build-version',
      apply: 'build',
      closeBundle() {
        try {
          mkdirSync('dist', { recursive: true })
          writeFileSync('dist/version.json', JSON.stringify({ v: String(buildTs) }), 'utf8')
        } catch { /* 忽略：版本文件写失败不阻塞构建 */ }
      },
    },
  ],
  define: { __BUILD_TS__: JSON.stringify(String(buildTs)) },
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
})
