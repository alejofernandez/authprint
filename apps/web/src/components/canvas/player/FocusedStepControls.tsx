'use client';

// UF-016 / UF-025 — the focused step's set: patch panel, floating to the right
// of the stage shape. Delete-from-here and back-to-recording live on the dock.

import type { ContextSlot } from '@authprint/dsl';
import { useTranslations } from 'next-intl';
import { StepPatchRow } from './StepPatchRow.tsx';
import type { EditableScriptStep } from './stepEditorTypes.ts';

export function FocusedStepControls({
  editable,
  contextSlots,
  onSetPatchChange,
  onErrorMessageChange,
  className,
}: {
  editable: EditableScriptStep;
  contextSlots: Record<string, ContextSlot>;
  onSetPatchChange: (slot: string, value: unknown | null) => void;
  onErrorMessageChange?: (message: string | null) => void;
  className?: string;
}) {
  const t = useTranslations('player');
  const setPatch = editable.step.set ?? {};
  const slotNames = Object.keys(contextSlots);
  const failing =
    editable.kind !== 'screen' && editable.step.result === 'error' && onErrorMessageChange
      ? editable.step
      : null;
  if (slotNames.length === 0 && !failing) return null;

  return (
    <div
      className={`rounded-lg border border-border-subtle bg-bg-panel/95 p-3 text-left shadow-sm dark:border-border-default ${className ?? ''}`}
    >
      {failing ? (
        <div className={slotNames.length > 0 ? 'mb-3' : ''}>
          <label
            className="block text-[10px] font-medium uppercase tracking-wider text-fg-subtle"
            htmlFor="step-error-message"
          >
            {t('stepEditor.errorMessage.title')}
          </label>
          <input
            id="step-error-message"
            key={`${editable.scriptStepIndex}-${failing.errorMessage ?? ''}`}
            type="text"
            defaultValue={failing.errorMessage ?? ''}
            placeholder={t('stepEditor.errorMessage.placeholder')}
            onBlur={(e) => onErrorMessageChange?.(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            className="mt-1 w-full select-text rounded border border-border-default bg-bg-panel px-2 py-1 text-sm text-fg-default outline-none focus:border-accent-primary-border focus-visible:ring-2 focus-visible:ring-accent-primary-border"
          />
          <p className="mt-1 text-[11px] leading-relaxed text-fg-subtle">
            {t('stepEditor.errorMessage.hint')}
          </p>
        </div>
      ) : null}
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
    </div>
  );
}
