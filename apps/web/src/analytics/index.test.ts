import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { activeProvider, consoleProvider, noopProvider, track } from './index.ts';

describe('analytics core', () => {
  const logSpy = spyOn(console, 'log');

  afterEach(() => {
    logSpy.mockClear();
  });

  describe('noopProvider', () => {
    test('does nothing when track is called', () => {
      noopProvider.track('test_event', { key: 'value' });
      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  describe('consoleProvider', () => {
    test('logs event name and properties', () => {
      consoleProvider.track('test_event', { key: 'value' });
      expect(logSpy).toHaveBeenCalledWith('[analytics] test_event', { key: 'value' });
    });

    test('logs event name only when properties are missing or empty', () => {
      consoleProvider.track('test_event_empty');
      expect(logSpy).toHaveBeenCalledWith('[analytics] test_event_empty');

      logSpy.mockClear();

      consoleProvider.track('test_event_empty_object', {});
      expect(logSpy).toHaveBeenCalledWith('[analytics] test_event_empty_object');
    });
  });

  describe('activeProvider selection and delegation', () => {
    test('resolves to noopProvider in test environment', () => {
      // In bun test, NODE_ENV is set to 'test', so activeProvider should be noopProvider
      expect(activeProvider).toBe(noopProvider);
    });

    test('track delegates to the activeProvider', () => {
      // Since activeProvider is noopProvider in test, calling track should not log
      track('delegate_test', { key: 'value' });
      expect(logSpy).not.toHaveBeenCalled();
    });
  });
});
