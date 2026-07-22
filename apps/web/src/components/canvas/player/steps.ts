// US-107 — derive typed player steps from a scenario run (headless contract).

import type {
  Divergence,
  Edge,
  Flow,
  Node,
  Predicate,
  Scenario,
  ScenarioRun,
  ScriptStep,
} from '@authprint/dsl';
import { resolveErrorBannerCopy } from '@authprint/dsl';
import { labelFor } from '../flowToReactFlow.ts';

export type PlayerStep = {
  index: number;
  nodeId: string;
  nodeType: Node['type'];
  displayName: string;
  /** Label of the edge this step exits through, or null on the final step. */
  exitTriggerLabel: string | null;
  /** Screen only: interaction action id for the next step, when known. */
  exitActionId: string | null;
  /** Decision only: formatted predicate question. */
  decisionQuestion: string | null;
  /** Decision only: branch taken (yes/no). */
  decisionBranch: boolean | null;
  /** Action/external only: result edge taken; null when the run ends on this step. */
  resolution: 'success' | 'error' | 'denied' | 'cancelled' | null;
  /** Outcome only: whether this outcome matches the scenario assertion. */
  matchesExpectedOutcome: boolean | null;
  /** Screen only: arrived via an on-error edge from the previous node. */
  enteredViaError: boolean;
  /** Screen only: resolved error-banner copy when enteredViaError; null otherwise. */
  errorBannerCopy: string | null;
  context: Record<string, unknown>;
};

export type PlayerModel = {
  steps: PlayerStep[];
  divergedIndex: number | null;
  divergence: Divergence | null;
};

export function derivePlayerSteps(flow: Flow, run: ScenarioRun): PlayerModel {
  const scenario = flow.scenarios.find((s) => s.id === run.scenarioId);
  const nodeById = new Map(flow.nodes.map((n) => [n.id, n]));
  const edgeById = new Map(flow.edges.map((e) => [e.id, e]));

  const steps: PlayerStep[] = run.trace.map((traceStep, index) => {
    const node = nodeById.get(traceStep.nodeId);
    if (!node) {
      throw new Error(`trace references unknown node '${traceStep.nodeId}'`);
    }

    const nextVia = run.trace[index + 1]?.viaEdgeId ?? null;
    const exitEdge = nextVia ? edgeById.get(nextVia) : undefined;
    const exitTriggerLabel = exitEdge ? formatExitLabel(exitEdge) : null;
    const exitActionId = exitEdge?.trigger.type === 'interaction' ? exitEdge.trigger.action : null;

    const context = run.contextSnapshots[index] ?? {};

    const incomingEdge =
      index > 0 && traceStep.viaEdgeId ? edgeById.get(traceStep.viaEdgeId) : undefined;
    const enteredViaError = incomingEdge?.trigger.type === 'on-error';
    const errorBannerCopy =
      node.type === 'screen' && enteredViaError
        ? screenErrorBannerCopyForStep(
            flow,
            run.trace,
            index,
            edgeById,
            nodeById,
            scenario?.inputScript,
          )
        : null;

    const base = {
      index,
      nodeId: node.id,
      nodeType: node.type,
      displayName: displayNameFor(node),
      exitTriggerLabel,
      exitActionId,
      decisionQuestion: null as string | null,
      decisionBranch: null as boolean | null,
      resolution: null as PlayerStep['resolution'],
      matchesExpectedOutcome: null as boolean | null,
      enteredViaError,
      errorBannerCopy,
      context,
    };

    switch (node.type) {
      case 'decision': {
        const branch = exitEdge?.trigger.type === 'branch' ? exitEdge.trigger.value : null;
        return {
          ...base,
          decisionQuestion: formatPredicateQuestion(node.predicate),
          decisionBranch: branch,
        };
      }
      case 'action':
      case 'external':
        return {
          ...base,
          resolution: resolutionFromExitEdge(exitEdge),
        };
      case 'outcome':
        return {
          ...base,
          matchesExpectedOutcome: expectedOutcomeMatches(scenario, node.id),
        };
      default:
        return base;
    }
  });

  return {
    steps,
    divergedIndex: divergedStepIndex(run),
    divergence: run.divergence,
  };
}

function displayNameFor(node: Node): string {
  if ('name' in node && node.name) return node.name;
  if ('kind' in node && node.kind) return node.kind;
  return node.id;
}

/** Resolve error-banner copy for a screen step entered via on-error. */
export function screenErrorBannerCopyForStep(
  flow: Flow,
  trace: ScenarioRun['trace'],
  stepIndex: number,
  edgeById?: Map<string, Edge>,
  nodeById?: Map<string, Node>,
  script?: readonly ScriptStep[],
): string | null {
  const traceStep = trace[stepIndex];
  if (!traceStep?.viaEdgeId || stepIndex <= 0) return null;

  const edges = edgeById ?? new Map(flow.edges.map((e) => [e.id, e]));
  const nodes = nodeById ?? new Map(flow.nodes.map((n) => [n.id, n]));
  const incomingEdge = edges.get(traceStep.viaEdgeId);
  if (incomingEdge?.trigger.type !== 'on-error') return null;

  // Scenario-step override: the failing node's script entry may carry the
  // exact copy this scenario wants the banner to show. Each scripted trace
  // node before the failing one consumed one script step, so counting maps
  // the trace position to the script position.
  const failingIndex = stepIndex - 1;
  let scenarioMessage: string | null = null;
  if (script) {
    let scriptedBefore = 0;
    for (let i = 0; i < failingIndex; i++) {
      const n = nodes.get(trace[i]?.nodeId ?? '');
      if (n && (n.type === 'screen' || n.type === 'action' || n.type === 'external')) {
        scriptedBefore++;
      }
    }
    const entry = script[scriptedBefore];
    if (
      entry &&
      entry.nodeId === trace[failingIndex]?.nodeId &&
      (entry.type === 'action' || entry.type === 'external')
    ) {
      scenarioMessage = entry.errorMessage ?? null;
    }
  }

  const prevNode = nodes.get(trace[failingIndex]?.nodeId ?? '');
  if (prevNode?.type === 'action' || prevNode?.type === 'external') {
    return resolveErrorBannerCopy(prevNode, scenarioMessage);
  }

  const edgeSource = nodes.get(incomingEdge.source);
  if (edgeSource?.type === 'action' || edgeSource?.type === 'external') {
    return resolveErrorBannerCopy(edgeSource, scenarioMessage);
  }

  return resolveErrorBannerCopy(null, scenarioMessage);
}

function formatExitLabel(edge: Edge): string {
  return edge.label ?? labelFor(edge.trigger) ?? edge.id;
}

function formatPredicateQuestion(predicate: Predicate): string {
  const value =
    typeof predicate.value === 'string' ? JSON.stringify(predicate.value) : String(predicate.value);
  return `${predicate.slot} ${predicate.op} ${value}?`;
}

function resolutionFromExitEdge(edge: Edge | undefined): PlayerStep['resolution'] {
  if (!edge) return null;
  switch (edge.trigger.type) {
    case 'on-success':
      return 'success';
    case 'on-error':
      return 'error';
    case 'on-denied':
      return 'denied';
    case 'on-cancelled':
      return 'cancelled';
    default:
      return null;
  }
}

function expectedOutcomeMatches(scenario: Scenario | undefined, outcomeId: string): boolean | null {
  if (!scenario?.expectedOutcome?.outcomeId) return null;
  return scenario.expectedOutcome.outcomeId === outcomeId;
}

export function isSilentPlayerStep(nodeType: Node['type']): boolean {
  return nodeType === 'action' || nodeType === 'external' || nodeType === 'decision';
}

/** Index of the most recent screen step strictly before `beforeIndex`, or null. */
export function lastScreenStepIndex(steps: PlayerStep[], beforeIndex: number): number | null {
  for (let i = beforeIndex - 1; i >= 0; i--) {
    if (steps[i]?.nodeType === 'screen') return i;
  }
  return null;
}

export function divergedStepIndex(run: ScenarioRun): number | null {
  if (run.status !== 'diverged' || !run.divergence) return null;

  if (run.divergence.kind === 'sequence-mismatch') {
    return run.divergence.atIndex;
  }

  const nodeId = nodeIdFromDivergence(run.divergence);
  if (!nodeId) return run.trace.length - 1;

  for (let i = run.trace.length - 1; i >= 0; i--) {
    if (run.trace[i]?.nodeId === nodeId) return i;
  }
  return run.trace.length - 1;
}

function nodeIdFromDivergence(d: Divergence): string | null {
  if ('nodeId' in d && typeof d.nodeId === 'string') return d.nodeId;
  return null;
}
