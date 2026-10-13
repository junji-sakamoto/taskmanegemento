import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 番地（ポート）は docs/技術スタック.md 2.3 のとおりに固定する
    port: 5173,
    strictPort: true,
    // 画面からの /api への通信を、Spring Boot へ取り次ぐ
    proxy: {
      '/api': 'http://127.0.0.1:8080',
    },
  },
})
