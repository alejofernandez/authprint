import { describe, expect, test } from 'bun:test';
import { resolveScreenTheme } from './screenTheme.ts';

describe('resolveScreenTheme', () => {
  test('light and dark flow themes ignore editor theme', () => {
    expect(resolveScreenTheme('light', 'dark')).toBe('light');
    expect(resolveScreenTheme('dark', 'light')).toBe('dark');
  });

  test('both follows editor light/dark', () => {
    expect(resolveScreenTheme('both', 'light')).toBe('light');
    expect(resolveScreenTheme('both', 'dark')).toBe('dark');
  });
});
