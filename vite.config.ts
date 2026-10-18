import { resolve } from 'node:path';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

const backend = 'http://127.0.0.1:' + (process.env.SHOPLY_PORT || '8765');

export default defineConfig({
  root: 'frontend',
  resolve: { alias: { '@': resolve('frontend/src') } },
  publicDir: '../public',
  plugins: [vue()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // Validate the browser origin before adapting it to the local Python origin.
    proxy: Object.fromEntries(
      ['/api', '/assets'].map((path) => [
        path,
        {
          target: backend,
          changeOrigin: true,
          configure(proxy) {
            proxy.on('proxyReq', (outgoing, incoming) => {
              const origin = incoming.headers.origin;
              if (origin && origin === 'http://127.0.0.1:5173')
                outgoing.setHeader('Origin', backend);
            });
          },
        },
      ]),
    ),
  },
  build: {
    outDir: '../.frontend-build',
    emptyOutDir: true,
    // public содержит пользовательские файлы; публикуются только результаты сборки.
    copyPublicDir: false,
    assetsDir: 'assets/build',
    rollupOptions: {
      input: {
        store: resolve('frontend/index.html'),
        admin: resolve('frontend/admin.html'),
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    restoreMocks: true,
  },
});
