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
  className,
}: {
  editable: EditableScriptStep;
  contextSlots: Record<string, ContextSlot>;
  onSetPatchChange: (slot: string, value: unknown | null) => void;
  className?: string;
}) {
  const t = useTranslations('player');
  const setPatch = editable.step.set ?? {};
  const slotNames = Object.keys(contextSlots);
  if (slotNames.length === 0) return null;

  return (
    <div
      className={`rounded-lg border border-border-subtle bg-bg-panel/95 p-3 text-left shadow-sm dark:border-border-default ${className ?? ''}`}
    >
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
    </div>
  );
}
