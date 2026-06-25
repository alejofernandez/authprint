import { consoleProvider, noopProvider } from './providers.ts';

export interface AnalyticsProvider {
  track(name: string, properties?: Record<string, unknown>): void;
}

export { consoleProvider, noopProvider };

export const activeProvider: AnalyticsProvider =
  process.env.NODE_ENV === 'development' ? consoleProvider : noopProvider;

export function track(name: string, properties?: Record<string, unknown>): void {
  activeProvider.track(name, properties);
}
