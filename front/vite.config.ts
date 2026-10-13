import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite 配置
 * - 开发端口 5173（前端设计文档约定）
 * - /api 代理到后端，避免跨域；后端默认 3000（可用 .env 中 VITE_PROXY_TARGET 覆盖）
 * - host: true 允许局域网访问，便于同事/测试智能体同机测试
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': {
          target: env.VITE_PROXY_TARGET ?? 'http://127.0.0.1:3000',
          changeOrigin: true,
        },
      },
    },
  };
});
