import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

// Browser smoke suite: runs valifetch against each engine's real native fetch.
// Kept separate from vitest.config.ts so it never joins the default test run
// or the 100% coverage gate.
export default defineConfig({
  test: {
    include: ['tests/browser/**/*.browser.test.ts'],
    globalSetup: ['tests/browser/global-setup.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [
        { browser: 'chromium' },
        { browser: 'firefox' },
        { browser: 'webkit' },
      ],
    },
  },
});
