import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.TEST_BASE_URL ?? 'http://localhost:3001',
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    reducedMotion: 'reduce',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  webServer: {
    command: 'pnpm dev',
    url: process.env.TEST_BASE_URL ?? 'http://localhost:3001',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
