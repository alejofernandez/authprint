// US-119 — props-only types for stage record mode (consumed by US-120 wiring).

import type { Branding, Flow, FlowTheme, Node, ScreenNode } from '@authprint/dsl';
import type { BranchFix, PendingDecision } from './recorder.ts';
import type { PlayerStep } from './steps.ts';

export type StageRecordCallbacks = {
  onRecordAction?: (actionId: string) => void;
  onRecordResult?: (result: string) => void;
  onContinueDecision?: () => void;
  onApplyBranchFix?: (fix: BranchFix) => void;
  onToggleExpectedOutcome?: (checked: boolean) => void;
  onDone?: () => void;
};

export type PlayerStageRecordProps = StageRecordCallbacks & {
  mode: 'record';
  /** Flow needed to resolve screen exit actions and destination names. */
  flow: Flow;
  headNode: Node;
  contextAtHead: Record<string, unknown>;
  pendingDecision?: PendingDecision | null;
  /** Display name of the previous scripted step (for step-patch fix labels). */
  previousStepName?: string | null;
  expectOutcomeChecked?: boolean;
};

export type PlayerStageViewProps = {
  mode?: 'view';
};

export type RecordModeScreenProps = {
  node: ScreenNode;
  flow: Flow;
  branding?: Branding;
  editorTheme: 'light' | 'dark';
  flowTheme: FlowTheme;
  immersive?: boolean;
  onRecordAction?: (actionId: string) => void;
  /** Editing an existing step: mark the recorded action + reword the caption. */
  selectedActionId?: string | null;
  editing?: boolean;
};

export type RecordModeDecisionProps = {
  pending: PendingDecision;
  contextAtHead: Record<string, unknown>;
  flow: Flow;
  previousStepName?: string | null;
  onContinueDecision?: () => void;
  onApplyBranchFix?: (fix: BranchFix) => void;
  /** False for a mid-trace focused decision: the branch is already walked. */
  showContinue?: boolean;
};

export type RecordModeResolveProps = {
  flow: Flow;
  node: Node;
  nodeType: 'action' | 'external';
  onRecordResult?: (result: string) => void;
  /** Editing an existing step: mark the recorded result + reword the caption. */
  selectedResult?: string | null;
  editing?: boolean;
};

export type RecordModeOutcomeProps = {
  step: PlayerStep;
  node: Node;
  expectOutcomeChecked?: boolean;
  onToggleExpectedOutcome?: (checked: boolean) => void;
  onDone?: () => void;
};
