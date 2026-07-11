import { describe, expect, test } from 'bun:test';
import { ERROR_BANNER_PLACEHOLDER, resolveErrorBannerCopy } from './errorBanner.ts';

describe('resolveErrorBannerCopy', () => {
  test('prefers authored errorMessage', () => {
    expect(
      resolveErrorBannerCopy({
        type: 'action',
        name: 'Validate credentials',
        errorMessage: 'Invalid username or password.',
      }),
    ).toBe('Invalid username or password.');
  });

  test('derives from node name when errorMessage is absent', () => {
    expect(
      resolveErrorBannerCopy({
        type: 'external',
        name: 'Google sign-in',
      }),
    ).toBe('Google sign-in failed');
  });

  test('falls back to placeholder when no failing node', () => {
    expect(resolveErrorBannerCopy(null)).toBe(ERROR_BANNER_PLACEHOLDER);
  });
});
