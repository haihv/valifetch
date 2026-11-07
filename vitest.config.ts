import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Browser smoke tests run under vitest.browser.config.ts (npm run test:browser)
    exclude: [...configDefaults.exclude, 'tests/browser/**'],
    // Agent worktrees under .claude/ hold full repo copies that must not be scanned
    benchmark: {
      include: ['bench/**/*.bench.ts'],
      exclude: [...configDefaults.exclude, '**/.claude/**'],
    },
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
