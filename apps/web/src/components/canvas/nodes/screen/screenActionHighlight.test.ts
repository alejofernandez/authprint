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

// UF-049: the passkey banner is how a `use-passkey` action is drawn, so the
// player must highlight the banner rather than falling through to a callout for
// an action link that is no longer rendered. The map is derived from the DSL's
// pair table, so this also guards against that derivation being restated.
describe('use-passkey highlighting (UF-049)', () => {
  test('maps use-passkey to the passkey banner when the trait is present', () => {
    expect(
      resolveScreenActionHighlightTarget('use-passkey', ['passkey-promotion'], [], 'password'),
    ).toBe('passkey-promotion');
  });

  test('falls back to a callout when the screen has no passkey trait', () => {
    expect(resolveScreenActionHighlightTarget('use-passkey', [], [], 'password')).toBe('callout');
  });
});
