// US-118 — props-only types for filmstrip edit UI (consumed by US-120 wiring).

import type { ContextSlot, ScriptStep } from '@authprint/dsl';
import type { PlayerStep } from './steps.ts';

/** Scripted step payload the popover edits — mirrors inputScript entries + display metadata. */
export type EditableScriptStep =
  | {
      kind: 'screen';
      scriptStepIndex: number;
      displayName: string;
      step: Extract<ScriptStep, { type: 'screen' }>;
      legalActions: readonly string[];
    }
  | {
      kind: 'action';
      scriptStepIndex: number;
      displayName: string;
      step: Extract<ScriptStep, { type: 'action' }>;
      legalResults: readonly ('success' | 'error')[];
    }
  | {
      kind: 'external';
      scriptStepIndex: number;
      displayName: string;
      step: Extract<ScriptStep, { type: 'external' }>;
      legalResults: readonly ('success' | 'error' | 'denied' | 'cancelled')[];
    };

export type StepEditorCallbacks = {
  onActionChange?: (action: string) => void;
  onResultChange?: (result: string) => void;
  onSetPatchChange?: (slot: string, value: unknown | null) => void;
  onDeleteFromHere?: () => void;
};

export type StepEditorPopoverProps = StepEditorCallbacks & {
  contextSlots: Record<string, ContextSlot>;
  onClose: () => void;
  /** Clip bounds in viewport coordinates — popover anchors below with flip/clamp. */
  anchor: { left: number; top: number; right: number; bottom: number };
} & (
    | { variant: 'derived'; step: PlayerStep }
    | { variant: 'scripted'; editable: EditableScriptStep }
  );

export type TimelineClipEditProps = {
  mode: 'edit';
  /** When true, shows the ✎ scripted marker. */
  scripted: boolean;
  /** When true, shows a compact `set:` indicator on the exit row. */
  hasSetPatch?: boolean;
  onEdit?: () => void;
};

export type TimelineClipViewProps = {
  mode?: 'view';
};
