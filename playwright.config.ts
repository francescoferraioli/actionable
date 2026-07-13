import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  // One Electron app at a time.
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
});
