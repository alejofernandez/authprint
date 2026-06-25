// Trait chrome for mockup screens (US-068). Each TRAIT_ID maps to a static
// visual affordance per the frozen trait→chrome table in WORK_BREAKDOWN.md.
// Field-adjacent traits (strength meter, show-password toggle) are rendered by
// ScreenMockup alongside the matching field rows; everything else composes in
// TRAIT_IDS order below the primary CTA.

import type { TraitId } from '@authprint/dsl';
import { TRAIT_IDS } from '@authprint/dsl';

const FIELD_TRAITS = new Set<TraitId>(['password-strength-meter', 'show-password-toggle']);

export function sortTraits(traits: TraitId[]): TraitId[] {
  const order = new Map(TRAIT_IDS.map((id, i) => [id, i]));
  return [...traits].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
}

export function postCtaTraits(traits: TraitId[]): TraitId[] {
  return sortTraits(traits).filter((t) => t !== 'bot-detection-invisible' && !FIELD_TRAITS.has(t));
}

function MockCheckbox({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-zinc-600 flow-dark:text-zinc-300">
      <span className="w-3 h-3 shrink-0 rounded-[3px] border border-zinc-300 bg-zinc-50 flow-dark:border-zinc-600 flow-dark:bg-zinc-800/60" />
      {label}
    </div>
  );
}

function MockLink({ children }: { children: string }) {
  return <span className="text-[10px] text-indigo-500 flow-dark:text-indigo-400">{children}</span>;
}

export function PasswordStrengthMeter() {
  return (
    <div className="flex gap-0.5 pt-0.5" aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length static meter segments
          key={i}
          className={`h-1 flex-1 rounded-full ${i < 2 ? 'bg-emerald-400 flow-dark:bg-emerald-500' : 'bg-zinc-200 flow-dark:bg-zinc-700'}`}
        />
      ))}
    </div>
  );
}

export function ShowPasswordToggle() {
  return (
    <span className="text-zinc-400 flow-dark:text-zinc-500" aria-hidden="true">
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden="true">
        <path
          d="M1.5 8s2.5-4 6.5-4 6.5 4 6.5 4-2.5 4-6.5 4S1.5 8 1.5 8Z"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <circle cx="8" cy="8" r="1.75" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    </span>
  );
}

function SocialLoginButtons() {
  const providers = ['G', 'A', 'M'] as const;
  return (
    <div className="flex justify-center gap-2">
      {providers.map((label) => (
        <div
          key={label}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-[9px] font-semibold text-zinc-500 flow-dark:border-zinc-600 flow-dark:bg-zinc-800 flow-dark:text-zinc-300"
        >
          {label}
        </div>
      ))}
    </div>
  );
}

function PasskeyBanner() {
  return (
    <div className="flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 flow-dark:border-indigo-800 flow-dark:bg-indigo-950/50">
      <svg
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5 shrink-0 text-indigo-500"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="5.5" cy="6" r="3" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M8 8l5 5M11 11l1.5-1.5M13 13l1.5-1.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-[10px] font-medium text-indigo-700 flow-dark:text-indigo-300">
        Sign in faster with a passkey
      </span>
    </div>
  );
}

function CaptchaWidget() {
  return (
    <div className="flex h-12 items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 flow-dark:border-zinc-600 flow-dark:bg-zinc-800/40">
      <span className="text-[9px] font-medium tracking-wide text-zinc-400 uppercase flow-dark:text-zinc-500">
        Captcha
      </span>
    </div>
  );
}

export function TraitChromeBlock({ trait }: { trait: TraitId }) {
  switch (trait) {
    case 'remember-me':
      return <MockCheckbox label="Remember me" />;
    case 'forgot-password-link':
      return <MockLink>Forgot password?</MockLink>;
    case 'alternative-method-link':
      return <MockLink>Try another way</MockLink>;
    case 'terms-checkbox-required':
      return <MockCheckbox label="I agree to the Terms" />;
    case 'marketing-opt-in':
      return <MockCheckbox label="Send me product updates" />;
    case 'social-login-buttons':
      return <SocialLoginButtons />;
    case 'passkey-promotion':
      return <PasskeyBanner />;
    case 'captcha':
      return <CaptchaWidget />;
    default:
      return null;
  }
}
