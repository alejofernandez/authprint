'use client';

// UF-016 — controls strip under a focused step's stage rendering. The choice
// itself (action/result) is edited by clicking the stage; this carries what
// the stage can't: typed set: patches, delete-from-here, back to recording.

import type { ContextSlot } from '@authprint/dsl';
import { useTranslations } from 'next-intl';
import { StepPatchRow } from './StepPatchRow.tsx';
import type { EditableScriptStep } from './stepEditorTypes.ts';

export function FocusedStepControls({
  editable,
  contextSlots,
  onSetPatchChange,
  onDeleteFromHere,
  onBackToRecording,
}: {
  editable: EditableScriptStep;
  contextSlots: Record<string, ContextSlot>;
  onSetPatchChange: (slot: string, value: unknown | null) => void;
  onDeleteFromHere: () => void;
  onBackToRecording: () => void;
}) {
  const t = useTranslations('player');
  const setPatch = editable.step.set ?? {};
  const slotNames = Object.keys(contextSlots);
  const rerouteTarget =
    editable.kind === 'screen'
      ? t('stepEditor.scripted.rerouteAction')
      : t('stepEditor.scripted.rerouteResult');

  return (
    <div className="mx-auto mt-4 w-[300px] rounded-lg border border-border-subtle bg-bg-panel/95 p-3 text-left shadow-sm dark:border-border-default">
      {slotNames.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
            {t('stepEditor.setPatch.title')}
          </p>
          {slotNames.map((slot) => (
            <StepPatchRow
              key={slot}
              slot={slot}
              declaration={contextSlots[slot] ?? { type: 'string' }}
              value={setPatch[slot]}
              onChange={(value) => onSetPatchChange(slot, value)}
            />
          ))}
        </div>
      ) : null}

      <p
        className={`text-xs leading-relaxed text-signal-warning-fg ${slotNames.length > 0 ? 'mt-3' : ''}`}
      >
        {t('stepEditor.scripted.rerouteWarning', { target: rerouteTarget })}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          className="flex-1 rounded border border-signal-danger-ring bg-signal-error-bg px-2 py-1.5 text-xs font-medium text-signal-error-label hover:bg-signal-error-bg-muted dark:border-signal-danger dark:bg-signal-error-bg-muted dark:text-signal-error-fg dark:hover:bg-signal-error-bg"
          onClick={onDeleteFromHere}
        >
          {t('stepEditor.scripted.deleteFromHere')}
        </button>
        <button
          type="button"
          className="flex-1 rounded border border-border-default px-2 py-1.5 text-xs font-medium text-fg-muted hover:bg-bg-subtle"
          onClick={onBackToRecording}
        >
          {t('edit.backToRecording')}
        </button>
      </div>
    </div>
  );
}
