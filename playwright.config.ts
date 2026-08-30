import { defineConfig, devices } from '@playwright/test';

const rawBase = process.env.E2E_BASE_PATH || '/localtools/';
const basePath = rawBase === '/' ? '/' : `/${rawBase.replace(/^\/+|\/+$/g, '')}/`;
const origin = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  workers: 1,
  webServer: {
    command: `BASE_PATH=${basePath} npm run build >/tmp/localtools-e2e-build.log && exec env BASE_PATH=${basePath} PORT=4173 npm run serve:dist`,
    url: `${origin}${basePath}`,
    reuseExistingServer: false,
  },
  use: { baseURL: `${origin}${basePath}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
