import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  server: {
    port: 3100,
    proxy: {
      '/api': { target: 'http://127.0.0.1:5163', changeOrigin: true },
      '/hubs': { target: 'http://127.0.0.1:5163', changeOrigin: true, ws: true },
    },
  },
});
