import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' — чтобы сайт работал и на GitHub Pages в подпапке, и на любом другом хостинге
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { include: ['scripts/**/*.test.mjs', 'src/**/*.test.ts'] },
})
