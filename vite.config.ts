import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    open: true,
    port: 5173,
    host: 'localhost',
    proxy: {
      '/proxy/strata': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/proxy\/strata/, ''),
      },
      '/proxy/zhipu': {
        target: 'https://open.bigmodel.cn',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/proxy\/zhipu/, ''),
      },
      '/proxy/deepseek': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/proxy\/deepseek/, ''),
      },
      '/proxy/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/proxy\/openai/, ''),
      },
      '/proxy/moonshot': {
        target: 'https://api.moonshot.cn',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/proxy\/moonshot/, ''),
      },
    },
  },
  preview: {
    open: true,
    port: 4173,
  },
});