// playwright.config.js
//
// Smoke-test config for the DashClaw dashboard. Runs a headless Chromium
// against a dedicated demo-mode dev server on port 3319, separate from any
// dev server the operator might be running on 3310.
//
// Usage:
//   npm run test:smoke                  # headless, full sweep
//   npm run test:smoke -- --headed      # watch it navigate
//   PW_BASE_URL=https://stage.example.com npm run test:smoke   # against staging

import { defineConfig, devices } from '@playwright/test';

const SMOKE_PORT = Number(process.env.PW_SMOKE_PORT || 3319);
const BASE_URL = process.env.PW_BASE_URL || `http://localhost:${SMOKE_PORT}`;
// When PW_BASE_URL is set, we assume an already-deployed target (staging/prod)
// and skip the local webServer boot.
const REMOTE_TARGET = Boolean(process.env.PW_BASE_URL);

export default defineConfig({
  testDir: './tests/smoke',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Demo-mode cookie unlocks dashboard routes without requiring a real
    // NextAuth session. Valid for 1 year per app/demo/route.js convention.
    storageState: {
      cookies: [
        {
          name: 'dashclaw_demo',
          value: '1',
          domain: 'localhost',
          path: '/',
          expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
          httpOnly: false,
          secure: false,
          sameSite: 'Lax',
        },
      ],
      origins: [],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: REMOTE_TARGET
    ? undefined
    : {
        // Demo mode — fixture data, no login required, writes return 403.
        // Ensures every dashboard route has something to render even on a
        // fresh clone with no DB. Uses the dedicated `dev:smoke` script on
        // port 3319 so it can't collide with a regular `pnpm dev` the
        // operator may already have running on 3310.
        command: 'pnpm dev:smoke',
        url: `${BASE_URL}/api/health`,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
        stdout: 'ignore',
        stderr: 'pipe',
        env: {
          DASHCLAW_MODE: 'demo',
          NEXT_PUBLIC_DASHCLAW_MODE: 'demo',
        },
      },
});
