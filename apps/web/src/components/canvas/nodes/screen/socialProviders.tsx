// Provider chrome for social sign-in actions (UF-051). A screen's provider
// buttons are derived from its `social-*` actions, so this file only answers
// "how is one provider drawn", never "which providers does this screen show".
//
// ─── On the artwork ─────────────────────────────────────────────────────────
// `mark` is a slot, and it is empty on purpose. Every one of these providers
// publishes an official sign-in asset under its own brand guidelines, and those
// files are the correct thing to put here: drawing the Google G, the Apple
// apple, or the Octocat freehand produces a wrong-looking trademark, which is
// worse than not drawing it. Drop a provider's official SVG in as `mark` and it
// renders in place of the monogram with no other change.
//
// Until then the fallback is a **branded monogram**: the provider's real accent
// colour, its initial, and a proper labelled button. That is what carries the
// visual weight anyway. A row of grey circles reading G / A / M looked like a
// placeholder because it was one; a labelled button in Google blue reads as a
// sign-in button even without the mark.

import type { ReactNode } from 'react';

export type SocialProviderChrome = {
  /** Button copy. Principle 7: what the real screen says. */
  label: string;
  /** Provider accent, used for the monogram badge and the button's border. */
  accent: string;
  /** Foreground on `accent`. */
  onAccent: string;
  /** Fallback badge glyph when no official mark is supplied. */
  monogram: string;
  /** Official brand artwork. See the note above before filling this in. */
  mark?: ReactNode;
};

// Accents are each provider's publicly documented brand colour, used here to
// tint a monogram badge rather than to reproduce a logo.
const PROVIDERS: Record<string, SocialProviderChrome> = {
  google: { label: 'Continue with Google', accent: '#4285F4', onAccent: '#ffffff', monogram: 'G' },
  apple: { label: 'Continue with Apple', accent: '#111111', onAccent: '#ffffff', monogram: 'A' },
  microsoft: {
    label: 'Continue with Microsoft',
    accent: '#2F2F2F',
    onAccent: '#ffffff',
    monogram: 'M',
  },
  facebook: {
    label: 'Continue with Facebook',
    accent: '#1877F2',
    onAccent: '#ffffff',
    monogram: 'f',
  },
  github: { label: 'Continue with GitHub', accent: '#24292F', onAccent: '#ffffff', monogram: 'G' },
};

/** Neutral chrome for the generic `social-login` chooser and for any custom
 *  `social-<provider>` the registry has never heard of. */
function fallbackChrome(provider: string | null): SocialProviderChrome {
  if (!provider) {
    return {
      label: 'Continue with a social account',
      accent: '#6B7280',
      onAccent: '#ffffff',
      monogram: '@',
    };
  }
  const pretty = provider.charAt(0).toUpperCase() + provider.slice(1).replace(/[-_]/g, ' ');
  return {
    label: `Continue with ${pretty}`,
    accent: '#6B7280',
    onAccent: '#ffffff',
    monogram: pretty.charAt(0).toUpperCase(),
  };
}

/** Chrome for a social action. Never returns null: an unregistered provider
 *  still renders a real button, which is what keeps the vocabulary open. */
export function socialChromeForProvider(provider: string | null): SocialProviderChrome {
  if (!provider) return fallbackChrome(null);
  return PROVIDERS[provider] ?? fallbackChrome(provider);
}

/** One provider button. Full width and labelled, which is what social sign-in
 *  actually looks like, rather than an icon-only circle. */
export function SocialProviderButton({ chrome }: { chrome: SocialProviderChrome }) {
  return (
    <div className="flex h-7 items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 flow-dark:border-zinc-700 flow-dark:bg-zinc-800">
      <span
        className="grid h-4 w-4 shrink-0 place-items-center overflow-hidden rounded-[4px] font-semibold text-[9px] leading-none"
        style={{ backgroundColor: chrome.accent, color: chrome.onAccent }}
        aria-hidden="true"
      >
        {chrome.mark ?? chrome.monogram}
      </span>
      <span className="truncate font-medium text-[10px] text-zinc-700 flow-dark:text-zinc-200">
        {chrome.label}
      </span>
    </div>
  );
}
