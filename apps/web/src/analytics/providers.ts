import type { AnalyticsProvider } from './index.ts';

export const noopProvider: AnalyticsProvider = {
  track(): void {
    // No-op
  },
};

export const consoleProvider: AnalyticsProvider = {
  track(name: string, properties?: Record<string, unknown>): void {
    if (properties && Object.keys(properties).length > 0) {
      console.log(`[analytics] ${name}`, properties);
    } else {
      console.log(`[analytics] ${name}`);
    }
  },
};
