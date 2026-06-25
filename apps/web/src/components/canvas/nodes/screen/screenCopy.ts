// Primary CTA label derived from a Screen's `kind` (US-067). The screen's
// headline is its node Name; the kind drives only the action button (and shows
// as a monospace tag in the window bar). `null` = informational screen with no
// primary action (e.g. a sent magic link, a loading state). Custom kinds fall
// back to a generic "Continue".

import type { ScreenKind } from '@authprint/dsl';

const CTA: Record<string, string | null> = {
  'identifier-collect': 'Continue',
  'email-collect': 'Continue',
  password: 'Sign in',
  'new-password': 'Continue',
  'passkey-enroll': 'Create passkey',
  'passkey-auth': 'Continue with passkey',
  'mfa-challenge': 'Verify',
  'mfa-enroll': 'Continue',
  consent: 'Allow',
  'terms-acceptance': 'Agree & continue',
  'email-verify': 'Verify',
  'phone-verify': 'Verify',
  'provider-select': null,
  'magic-link-sent': null,
  'account-recovery': 'Continue',
  error: null,
  loading: null,
};

export function humanize(s: string): string {
  return s.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function screenCta(kind: ScreenKind): string | null {
  // Distinguish "kind not in map" (→ generic Continue) from a mapped `null`
  // (informational screen, no button). undefined = absent key.
  const cta = CTA[kind];
  return cta === undefined ? 'Continue' : cta;
}
