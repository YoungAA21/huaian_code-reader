import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3000,
    proxy: {
      '/hubs': {
        target: 'http://192.168.31.154:8989',
        changeOrigin: true,
        ws: true,  // 重要：支持 WebSocket 代理
      }
    }
  }
})