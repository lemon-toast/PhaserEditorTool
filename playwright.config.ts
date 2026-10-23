import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 45000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5183',
    channel: 'chrome',
    viewport: { width: 1500, height: 950 },
    launchOptions: {
      args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader'],
    },
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'npm run dev -- --port 5183',
      url: 'http://127.0.0.1:5183',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      command: 'npm --prefix ../SlotClient run dev -- --host 127.0.0.1 --port 5174',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
});
