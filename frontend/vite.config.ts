import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 开发期把 /api 代理到本地后端（:10000），避免 CORS；
// 生产期由 VITE_API_URL 指向 Render 后端地址。
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:10000', changeOrigin: true },
    },
  },
});
