import { defineConfig } from 'vitest/config';

// Coverage config for integration tests only — no thresholds enforced.
// Run with: npm run test:integration:coverage
// Shows which src/ lines the integration tests exercise independently.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/types/**/*.ts', 'src/index.ts', 'src/error.ts', 'src/types.ts'],
    },
  },
});
