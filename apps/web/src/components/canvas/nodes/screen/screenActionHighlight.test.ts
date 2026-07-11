import { describe, expect, test } from 'bun:test';
import { resolveScreenActionHighlightTarget } from './screenActionHighlight.tsx';

describe('resolveScreenActionHighlightTarget', () => {
  test('maps primary actions to the main CTA', () => {
    expect(resolveScreenActionHighlightTarget('submit', [], [], 'password')).toBe('primary-cta');
  });

  test('maps forgot-password to its trait chrome when present', () => {
    expect(
      resolveScreenActionHighlightTarget(
        'forgot-password',
        ['forgot-password-link'],
        [],
        'password',
      ),
    ).toBe('forgot-password-link');
  });

  test('maps passkey-auth submit to the passkey field affordance', () => {
    expect(
      resolveScreenActionHighlightTarget(
        'submit',
        [],
        [{ name: 'passkey', type: 'passkey', required: true }],
        'passkey-auth',
      ),
    ).toBe('passkey-field');
  });

  test('falls back to a callout for flexible actions without chrome', () => {
    expect(resolveScreenActionHighlightTarget('skip', [], [], 'passkey-enroll')).toBe('callout');
    expect(resolveScreenActionHighlightTarget('back', [], [], 'password')).toBe('retreat');
  });
});
