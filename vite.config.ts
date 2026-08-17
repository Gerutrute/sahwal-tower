import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  // Orca IDE 포털처럼 하위 경로로 프록시될 때도 정적 자산을 같은 경로에서 불러온다.
  base: './',
  plugins: [
    react(),
    legacy({
      targets: ['Android >= 7', 'iOS >= 12'],
      modernPolyfills: true,
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    clearMocks: true,
  },
});
