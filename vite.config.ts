import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
  test: {
    // 只跑本项目测试：two-step-count/ 是 GitHub 仓库快照副本，不要重复收集
    include: ['tests/**/*.test.ts'],
  },
});
