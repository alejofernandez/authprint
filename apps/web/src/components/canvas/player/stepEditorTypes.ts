// US-118 — props-only types for filmstrip edit UI (consumed by US-120 wiring).

import type { ScriptStep } from '@authprint/dsl';

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
