// Screen copy derived from `kind` (US-067). A Screen renders as a believable
// auth screen: the headline + primary CTA come from the screen's kind, not its
// node name (name is the graph label; the headline is what an end-user reads).
// Custom kinds fall back to a humanized kind string + a generic "Continue".

import type { ScreenKind } from '@authprint/dsl';

export type ScreenCopy = { title: string; cta: string | null };

// `cta: null` = an informational screen with no primary action (e.g. a sent
// magic link, a loading state) — render no button.
const COPY: Record<string, ScreenCopy> = {
  'identifier-collect': { title: 'Sign in', cta: 'Continue' },
  'email-collect': { title: "What's your email?", cta: 'Continue' },
  password: { title: 'Enter your password', cta: 'Sign in' },
  'new-password': { title: 'Create a password', cta: 'Continue' },
  'passkey-enroll': { title: 'Create a passkey', cta: 'Create passkey' },
  'passkey-auth': { title: 'Use your passkey', cta: 'Continue with passkey' },
  'mfa-challenge': { title: 'Verify it’s you', cta: 'Verify' },
  'mfa-enroll': { title: 'Set up 2-step verification', cta: 'Continue' },
  consent: { title: 'Allow access?', cta: 'Allow' },
  'terms-acceptance': { title: 'Review the terms', cta: 'Agree & continue' },
  'email-verify': { title: 'Check your email', cta: 'Verify' },
  'phone-verify': { title: 'Verify your phone', cta: 'Verify' },
  'provider-select': { title: 'Choose how to continue', cta: null },
  'magic-link-sent': { title: 'Check your email', cta: null },
  'account-recovery': { title: 'Recover your account', cta: 'Continue' },
  error: { title: 'Something went wrong', cta: null },
  loading: { title: 'Just a moment…', cta: null },
};

export function humanize(s: string): string {
  return s.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function screenCopy(kind: ScreenKind): ScreenCopy {
  return COPY[kind] ?? { title: humanize(kind), cta: 'Continue' };
}
