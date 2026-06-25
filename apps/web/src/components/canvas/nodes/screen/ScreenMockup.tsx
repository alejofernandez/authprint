// Screen mockup rendering (US-067, E39) — renders a Screen node as a believable
// auth screen for `fidelity: 'mockup'`: a windowed card with a brand-neutral
// logo, a kind-derived headline, field rows from `fields`, and a primary CTA.
// Traits (US-068), the wireframe/lo-fi tiers (US-069), and the Flow.theme axis
// (US-070) build on this. The visual language set here is what they extend.

import type { Field, ScreenNode } from '@authprint/dsl';
import { humanize, screenCopy } from './screenCopy.ts';

const MASKED_TYPES = new Set(['password', 'new-password', 'confirm-password']);

function BrandGlyph() {
  return (
    <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none" aria-hidden="true">
      <path d="M6 1l1.6 3.4L11 6 7.6 7.6 6 11 4.4 7.6 1 6l3.4-1.6L6 1z" fill="currentColor" />
    </svg>
  );
}

function TextInput({ masked }: { masked: boolean }) {
  return (
    <div className="h-6 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 px-2 flex items-center">
      {masked ? (
        <span className="text-[10px] tracking-[0.2em] text-zinc-400 dark:text-zinc-500">
          ••••••••
        </span>
      ) : null}
    </div>
  );
}

function OtpInput() {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length static mockup boxes
          key={i}
          className="w-5 h-6 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60"
        />
      ))}
    </div>
  );
}

function PasskeyButton() {
  return (
    <div className="h-7 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 flex items-center justify-center gap-1.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-200">
      <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" aria-hidden="true">
        <circle cx="5.5" cy="6" r="3" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M8 8l5 5M11 11l1.5-1.5M13 13l1.5-1.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
      Passkey
    </div>
  );
}

function FieldRow({ field }: { field: Field }) {
  if (field.type === 'consent-checkbox') {
    // A static mock of a checkbox row — not a real control, so a plain div
    // (not <label>) is correct here.
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-600 dark:text-zinc-300">
        <span className="w-3 h-3 rounded-[3px] border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800/60" />
        {humanize(field.name)}
      </div>
    );
  }
  if (field.type === 'passkey') {
    return <PasskeyButton />;
  }
  return (
    <div className="space-y-1">
      <div className="text-[9px] font-medium text-zinc-500 dark:text-zinc-400">
        {humanize(field.name)}
      </div>
      {field.type === 'otp' ? <OtpInput /> : <TextInput masked={MASKED_TYPES.has(field.type)} />}
    </div>
  );
}

export function ScreenMockup({ node }: { node: ScreenNode }) {
  const { title, cta } = screenCopy(node.kind);
  return (
    <div className="w-[244px] rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
      {/* window chrome — gives the card a "screen" read without brand assets */}
      <div className="h-5 flex items-center gap-1 px-2.5 border-b border-zinc-100 dark:border-zinc-800">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
      </div>
      <div className="px-4 pt-3.5 pb-4 space-y-3">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex w-4 h-4 items-center justify-center rounded-[5px] bg-indigo-500 text-white">
            <BrandGlyph />
          </span>
          <span className="text-[10px] font-semibold tracking-wide text-zinc-400 dark:text-zinc-500">
            Acme
          </span>
        </div>
        <div className="text-[13px] font-semibold leading-tight text-zinc-900 dark:text-zinc-100">
          {title}
        </div>
        {node.fields.length > 0 ? (
          <div className="space-y-2">
            {node.fields.map((f) => (
              <FieldRow key={f.name} field={f} />
            ))}
          </div>
        ) : null}
        {cta ? (
          <div className="h-7 rounded-md bg-indigo-500 text-white text-[11px] font-medium flex items-center justify-center">
            {cta}
          </div>
        ) : null}
      </div>
    </div>
  );
}
