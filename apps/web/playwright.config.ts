import { defineConfig, devices } from '@playwright/test';

// Behaviour tests for the canvas. These are deliberately NOT the visual suite:
// they assert DOM state, focus order, event outcomes and geometry, none of which
// depend on font rasterization — which is exactly why they can run in CI while
// the pixel baselines still wait for a pinned screenshot environment (AGENTS.md).
//
// They run against a production build, not `next dev`: the dev overlay injects
// its own focusable chrome, and a tab-order assertion cannot tell that apart
// from the app's own.

const PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  // `.e2e.ts`, not `.spec.ts`: `bun test` globs *.spec.ts and would try to run
  // these as unit tests. One runner per extension keeps both suites honest.
  testMatch: /.*\.e2e\.ts$/,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // `next start` warns that it is not the standalone entrypoint (next.config
    // sets `output: 'standalone'` for the Docker image). It still serves the
    // normal `.next` build correctly, which is what these tests need — do not
    // "fix" the warning by pointing at .next/standalone/server.js without also
    // copying static assets the way the Dockerfile does.
    command: `bun run build && bun run start --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
