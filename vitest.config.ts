import { defineConfig } from 'vitest/config';

export default defineConfig({
  benchmark: {
    include: ['bench/**/*.bench.ts'],
    reporters: ['default'],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    reporters: ['default', ['junit', { outputFile: 'test-results/junit.xml' }]],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'cobertura'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/types/**/*.ts',
        'src/mock/types.ts',
        'src/index.ts',
        'src/error.ts',
        'src/types.ts',
        'src/mock.ts',
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
