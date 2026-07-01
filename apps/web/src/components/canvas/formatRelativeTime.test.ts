import { describe, expect, test } from 'bun:test';
import { formatRelativeTime } from './formatRelativeTime.ts';

describe('formatRelativeTime', () => {
  test('formats recent timestamps in English', () => {
    const now = Date.parse('2026-07-01T12:00:00Z');
    expect(formatRelativeTime(now - 30_000, now)).toBe('30 seconds ago');
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5 minutes ago');
    expect(formatRelativeTime(now - 2 * 60 * 60_000, now)).toBe('2 hours ago');
  });
});
