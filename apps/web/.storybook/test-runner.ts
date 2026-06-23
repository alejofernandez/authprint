import path from 'node:path';

import type { TestRunnerConfig } from '@storybook/test-runner';
import { toMatchImageSnapshot } from 'jest-image-snapshot';

// The runner drives every story in a real (headless Chromium) browser and, in
// `postVisit`, screenshots it and pixel-diffs against a committed baseline —
// the self-hosted equivalent of storybook-chrome-screenshot + reg-suit. New
// stories write their baseline on first run; later runs fail if the pixels
// drift (run `test-storybook -u` to bless an intentional change).

// `expect` is a Jest global inside the runner; reach it via `globalThis` so this
// config stays self-contained (no @types/jest, no global redeclare conflicts).
type ImageSnapshotExpect = {
  extend(matchers: Record<string, unknown>): void;
  (
    actual: unknown,
  ): {
    toMatchImageSnapshot(options?: Record<string, unknown>): void;
  };
};
const expect = (globalThis as unknown as { expect: ImageSnapshotExpect }).expect;

const customSnapshotsDir = path.join(process.cwd(), '__snapshots__', 'visual');

const config: TestRunnerConfig = {
  setup() {
    expect.extend({ toMatchImageSnapshot });
  },
  async postVisit(page, context) {
    // Capture just the fixed-size canvas (not the full viewport) so the baseline
    // is tight and a small node change is a large fraction of the diff.
    const canvas = page.locator('[data-testid="node-canvas"]');
    // Wait for the node and webfonts so the capture is never taken mid-render.
    await canvas.locator('.react-flow__node').first().waitFor({ state: 'visible' });
    await page.evaluate(() => document.fonts.ready);

    const image = await canvas.screenshot();
    expect(image).toMatchImageSnapshot({
      customSnapshotsDir,
      customSnapshotIdentifier: context.id,
      // Tolerate sub-pixel antialiasing noise; real regressions are far larger.
      failureThreshold: 0.01,
      failureThresholdType: 'percent',
    });
  },
};

export default config;
