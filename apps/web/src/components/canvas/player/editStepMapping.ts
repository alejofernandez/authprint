import type { Flow, Scenario, ScriptStep } from '@authprint/dsl';
import { nodeDisplayName, screenExitActions } from './screenExitActions.ts';
import type { EditableScriptStep } from './stepEditorTypes.ts';
import type { PlayerStep } from './steps.ts';

/** Map a filmstrip player step to its inputScript index, or null if derived. */
export function scriptStepIndexForPlayerStep(
  draft: Scenario,
  steps: readonly PlayerStep[],
  playerStepIndex: number,
): number | null {
  let scriptIdx = 0;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step) continue;
    if (step.nodeType !== 'screen' && step.nodeType !== 'action' && step.nodeType !== 'external') {
      continue;
    }
    const scriptStep = draft.inputScript[scriptIdx];
    if (!scriptStep) return null;
    if (i === playerStepIndex) {
      if (scriptStep.nodeId !== step.nodeId || scriptStep.type !== step.nodeType) return null;
      return scriptIdx;
    }
    scriptIdx++;
  }
  return null;
}

export function buildEditableScriptStep(
  flow: Flow,
  draft: Scenario,
  steps: readonly PlayerStep[],
  playerStepIndex: number,
): EditableScriptStep | null {
  const scriptIndex = scriptStepIndexForPlayerStep(draft, steps, playerStepIndex);
  if (scriptIndex === null) return null;
  const scriptStep = draft.inputScript[scriptIndex];
  const playerStep = steps[playerStepIndex];
  if (!scriptStep || !playerStep) return null;

  const displayName = playerStep.displayName || nodeDisplayName(flow, scriptStep.nodeId);

  if (scriptStep.type === 'screen') {
    return {
      kind: 'screen',
      scriptStepIndex: scriptIndex,
      displayName,
      step: scriptStep,
      legalActions: screenExitActions(flow, scriptStep.nodeId).map((a) => a.actionId),
    };
  }
  if (scriptStep.type === 'action') {
    return {
      kind: 'action',
      scriptStepIndex: scriptIndex,
      displayName,
      step: scriptStep,
      legalResults: ['success', 'error'] as const,
    };
  }
  return {
    kind: 'external',
    scriptStepIndex: scriptIndex,
    displayName,
    step: scriptStep,
    legalResults: ['success', 'error', 'denied', 'cancelled'] as const,
  };
}

export function hasSetPatch(step: ScriptStep | undefined): boolean {
  return Boolean(step?.set && Object.keys(step.set).length > 0);
}
