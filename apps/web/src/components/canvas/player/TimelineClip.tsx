'use client';

import { useTranslations } from 'next-intl';
import { clipToneClasses, structuralTypeLabel } from './playerClipTone.ts';
import type { TimelineClipEditProps, TimelineClipViewProps } from './stepEditorTypes.ts';
import type { PlayerStep } from './steps.ts';

type TimelineClipBaseProps = {
  step: PlayerStep;
  active?: boolean;
  diverged?: boolean;
  onSeek?: () => void;
  onRevealOnCanvas?: () => void;
  revealLabel?: string;
};

export type TimelineClipProps = TimelineClipBaseProps &
  (TimelineClipViewProps | TimelineClipEditProps);

export function TimelineClip(props: TimelineClipProps) {
  const { step, active = false, diverged = false, onSeek, onRevealOnCanvas, revealLabel } = props;

  const isEdit = props.mode === 'edit';
  const scripted = isEdit ? props.scripted : false;
  const hasSetPatch = isEdit ? (props.hasSetPatch ?? false) : false;
  const onEdit = isEdit ? props.onEdit : undefined;

  const tone = diverged
    ? 'border-signal-danger-ring bg-signal-error-bg text-signal-error-label dark:border-signal-danger dark:bg-signal-error-bg-muted dark:text-signal-error-fg'
    : clipToneClasses(step.nodeType);

  const exitLabel = step.exitTriggerLabel
    ? `→ ${step.exitTriggerLabel}${hasSetPatch ? ' · set:' : ''}`
    : hasSetPatch
      ? '· set:'
      : '\u00A0';

  const typeLabel = `${structuralTypeLabel(step.nodeType)}${scripted ? ' ✎' : ''}`;

  const mainButton = (
    <button
      type="button"
      onClick={isEdit && onEdit ? onEdit : onSeek}
      disabled={isEdit ? !onEdit : !onSeek}
      className={`flex flex-col px-2.5 py-1.5 text-left ${
        (isEdit && onEdit) || onSeek ? 'cursor-pointer hover:shadow-sm' : 'cursor-default'
      }`}
      aria-label={`Step ${step.index + 1}: ${step.displayName}`}
    >
      <div className="mb-0.5 text-[11px] uppercase tracking-wide opacity-75">{typeLabel}</div>
      <div className="line-clamp-2 min-h-8 text-xs font-medium leading-snug">
        {step.displayName}
      </div>
      <div className="mt-0.5 min-h-[14px] text-[11px] opacity-70">{exitLabel}</div>
    </button>
  );

  return (
    <div
      className={`flex w-[120px] shrink-0 flex-col rounded-lg border transition-shadow duration-[var(--duration-fast)] ease-standard ${tone} ${
        active
          ? 'ring-2 ring-accent-primary-border ring-offset-1 ring-offset-bg-canvas dark:ring-accent-primary'
          : ''
      }`}
      aria-current={active ? 'step' : undefined}
    >
      {mainButton}
      {!isEdit && onRevealOnCanvas && revealLabel ? (
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

/** Dashed clip at the strip end while recording — the next node to script. */
export function GhostHeadClip({ nextDisplayName }: { nextDisplayName: string }) {
  const t = useTranslations('player.ghostHead');

  // Mirrors TimelineClip's row skeleton exactly (caption / min-h-8 name /
  // min-h-[14px] footer + the same paddings) so the strip's height never
  // changes when the ghost appears or leaves (UF-033).
  return (
    <div className="flex w-[120px] shrink-0 flex-col rounded-lg border border-accent-primary-border-muted border-dashed bg-transparent px-2.5 py-1.5 text-left">
      <div className="mb-0.5 text-[11px] uppercase tracking-wide text-accent-primary-fg opacity-75">
        ⏸
      </div>
      <div className="line-clamp-2 min-h-8 text-xs font-medium leading-snug text-fg-default">
        {nextDisplayName}
      </div>
      <div className="mt-0.5 min-h-[14px] truncate text-[11px] text-fg-subtle opacity-70">
        {t('chooseOnStage')}
      </div>
    </div>
  );
}
