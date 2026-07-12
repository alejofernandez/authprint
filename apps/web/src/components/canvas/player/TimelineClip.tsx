'use client';

import { clipToneClasses, structuralTypeLabel } from './playerClipTone.ts';
import type { PlayerStep } from './steps.ts';

export type TimelineClipProps = {
  step: PlayerStep;
  active?: boolean;
  diverged?: boolean;
  onSeek?: () => void;
  onRevealOnCanvas?: () => void;
  revealLabel?: string;
};

export function TimelineClip({
  step,
  active = false,
  diverged = false,
  onSeek,
  onRevealOnCanvas,
  revealLabel,
}: TimelineClipProps) {
  const tone = diverged
    ? 'border-signal-danger-ring bg-signal-error-bg text-signal-error-label dark:border-signal-danger dark:bg-signal-error-bg-muted dark:text-signal-error-fg'
    : clipToneClasses(step.nodeType);

  return (
    <div
      className={`flex w-[120px] shrink-0 flex-col rounded-lg border transition-shadow duration-[var(--duration-fast)] ease-standard ${tone} ${
        active
          ? 'ring-2 ring-accent-primary-border ring-offset-1 ring-offset-bg-canvas dark:ring-accent-primary'
          : ''
      }`}
      aria-current={active ? 'step' : undefined}
    >
      <button
        type="button"
        onClick={onSeek}
        disabled={!onSeek}
        className={`flex flex-col px-2.5 py-1.5 text-left ${
          onSeek ? 'cursor-pointer hover:shadow-sm' : 'cursor-default'
        }`}
        aria-label={`Step ${step.index + 1}: ${step.displayName}`}
      >
        <div className="mb-0.5 text-[11px] uppercase tracking-wide opacity-75">
          {structuralTypeLabel(step.nodeType)}
        </div>
        <div className="line-clamp-2 min-h-8 text-xs font-medium leading-snug">
          {step.displayName}
        </div>
        <div className="mt-0.5 min-h-[14px] text-[11px] opacity-70">
          {step.exitTriggerLabel ? `→ ${step.exitTriggerLabel}` : '\u00A0'}
        </div>
      </button>
      {onRevealOnCanvas && revealLabel ? (
        <button
          type="button"
          onClick={onRevealOnCanvas}
          className="border-border-subtle border-t px-2.5 py-1 text-[10px] font-medium text-accent-primary-fg-emphasis hover:bg-black/5 dark:border-border-default dark:text-accent-primary-fg-on-bg dark:hover:bg-white/10"
        >
          {revealLabel}
        </button>
      ) : null}
    </div>
  );
}
