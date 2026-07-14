// US-117 — headless scenario recorder core (Edit mode engine).

import type {
  Edge,
  Flow,
  Node,
  Predicate,
  Scenario,
  ScenarioRun,
  ScriptStep,
  TraceStep,
} from '@authprint/dsl';
import { evaluatePredicate, runScenario } from '@authprint/dsl';
import { derivePlayerSteps, type PlayerStep } from './steps.ts';

export type RecordingHead = {
  nodeId: string;
  nodeType: Node['type'];
};

export type BranchFix =
  | { kind: 'initial-context'; slot: string; value: unknown }
  | { kind: 'step-patch'; stepIndex: number; slot: string; value: unknown }
  | { kind: 'needs-value'; slot: string; op: Predicate['op'] };

export type PendingDecision = {
  nodeId: string;
  question: string;
  predicate: Predicate;
  takenBranch: boolean;
  takenDestinationId: string;
  otherBranch: boolean;
  otherDestinationId: string;
  fixes: BranchFix[];
};

export type RecordingModel = {
  steps: PlayerStep[];
  head: RecordingHead;
  pendingDecision: PendingDecision | null;
  contextAtHead: Record<string, unknown>;
  note: string | null;
};

type WalkResult = {
  trace: TraceStep[];
  contextSnapshots: Record<string, unknown>[];
  head: RecordingHead;
  pendingDecision: PendingDecision | null;
  note: string | null;
  complete: boolean;
  reachedOutcomeId: string | null;
};

function cloneContext(ctx: Record<string, unknown>): Record<string, unknown> {
  return { ...ctx };
}

function flowWithDraft(flow: Flow, draft: Scenario): Flow {
  const hasDraft = flow.scenarios.some((s) => s.id === draft.id);
  const scenarios = hasDraft
    ? flow.scenarios.map((s) => (s.id === draft.id ? draft : s))
    : [...flow.scenarios, draft];
  return { ...flow, scenarios };
}

function nodeById(flow: Flow): Map<string, Node> {
  return new Map(flow.nodes.map((n) => [n.id, n]));
}

function edgesBySource(flow: Flow): Map<string, Edge[]> {
  const map = new Map<string, Edge[]>();
  for (const edge of flow.edges) {
    const list = map.get(edge.source) ?? [];
    list.push(edge);
    map.set(edge.source, list);
  }
  return map;
}

function formatPredicateQuestion(predicate: Predicate): string {
  const value =
    typeof predicate.value === 'string' ? JSON.stringify(predicate.value) : String(predicate.value);
  return `${predicate.slot} ${predicate.op} ${value}?`;
}

function branchEdge(edges: Edge[], value: boolean): Edge | undefined {
  return edges.find((e) => e.trigger.type === 'branch' && e.trigger.value === value);
}

function stepMatchesDownstream(flow: Flow, fromNodeId: string, step: ScriptStep): boolean {
  if (step.nodeId === fromNodeId) return true;
  const bySource = edgesBySource(flow);
  const visited = new Set<string>();
  const queue = [fromNodeId];
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || visited.has(id)) continue;
    visited.add(id);
    if (id === step.nodeId) return true;
    for (const edge of bySource.get(id) ?? []) {
      queue.push(edge.target);
    }
  }
  return false;
}

function applyStepPatch(
  currentContext: Record<string, unknown>,
  step: ScriptStep,
): Record<string, unknown> {
  if (!step.set || Object.keys(step.set).length === 0) return currentContext;
  return { ...currentContext, ...step.set };
}

// Only booleans have a single derivable "other" value; anything else must
// prompt — a null write would fail the slot's declared-type validation.
function negateEqualsValue(value: unknown): unknown {
  if (typeof value === 'boolean') return !value;
  return undefined;
}

function buildPendingDecision(
  flow: Flow,
  node: Extract<Node, { type: 'decision' }>,
  context: Record<string, unknown>,
  lastScriptedStepIndex: number | null,
): PendingDecision | null {
  const edges = edgesBySource(flow).get(node.id) ?? [];
  const evalResult = evaluatePredicate(flow, node.id, node.predicate, context);
  if (evalResult.kind === 'error') {
    const trueEdge = branchEdge(edges, true);
    const falseEdge = branchEdge(edges, false);
    return {
      nodeId: node.id,
      question: formatPredicateQuestion(node.predicate),
      predicate: node.predicate,
      takenBranch: false,
      takenDestinationId: falseEdge?.target ?? '',
      otherBranch: true,
      otherDestinationId: trueEdge?.target ?? '',
      fixes: [{ kind: 'needs-value', slot: node.predicate.slot, op: node.predicate.op }],
    };
  }

  const takenBranch = evalResult.value;
  const otherBranch = !takenBranch;
  const takenEdge = branchEdge(edges, takenBranch);
  const otherEdge = branchEdge(edges, otherBranch);
  if (!takenEdge || !otherEdge) return null;

  const otherValue =
    node.predicate.op === 'equals'
      ? otherBranch
        ? node.predicate.value
        : negateEqualsValue(node.predicate.value)
      : undefined;

  const fixes: BranchFix[] = [];
  if (node.predicate.op === 'equals' && otherValue !== undefined) {
    fixes.push({
      kind: 'initial-context',
      slot: node.predicate.slot,
      value: otherValue,
    });
    if (lastScriptedStepIndex !== null) {
      fixes.push({
        kind: 'step-patch',
        stepIndex: lastScriptedStepIndex,
        slot: node.predicate.slot,
        value: otherValue,
      });
    }
  } else {
    fixes.push({ kind: 'needs-value', slot: node.predicate.slot, op: node.predicate.op });
  }

  return {
    nodeId: node.id,
    question: formatPredicateQuestion(node.predicate),
    predicate: node.predicate,
    takenBranch,
    takenDestinationId: takenEdge.target,
    otherBranch,
    otherDestinationId: otherEdge.target,
    fixes,
  };
}

/** Recording walk — pauses at decisions (§7) and script-exhausted nodes. */
function recordingWalk(flow: Flow, draft: Scenario): WalkResult {
  const entry = flow.nodes.find((n) => n.type === 'entry');
  if (!entry) {
    return {
      trace: [],
      contextSnapshots: [cloneContext(draft.initialContext)],
      head: { nodeId: '', nodeType: 'entry' },
      pendingDecision: null,
      note: 'flow has no entry node',
      complete: false,
      reachedOutcomeId: null,
    };
  }

  const nodes = nodeById(flow);
  const bySource = edgesBySource(flow);
  const scriptQueue = [...draft.inputScript];
  const maxSteps = flow.nodes.length * 8;

  let currentContext = cloneContext(draft.initialContext);
  const trace: TraceStep[] = [{ nodeId: entry.id, viaEdgeId: null }];
  const contextSnapshots: Record<string, unknown>[] = [cloneContext(currentContext)];
  let current: Node = entry;
  let iterations = 1;
  let lastScriptedStepIndex: number | null = null;

  while (iterations <= maxSteps) {
    if (current.type === 'outcome') {
      return {
        trace,
        contextSnapshots,
        head: { nodeId: current.id, nodeType: 'outcome' },
        pendingDecision: null,
        note: null,
        complete: true,
        reachedOutcomeId: current.id,
      };
    }

    if (current.type === 'decision') {
      const pending = buildPendingDecision(flow, current, currentContext, lastScriptedStepIndex);
      const nextStep = scriptQueue[0];
      if (pending && nextStep) {
        const takenEdge = branchEdge(bySource.get(current.id) ?? [], pending.takenBranch);
        if (takenEdge && stepMatchesDownstream(flow, takenEdge.target, nextStep)) {
          const target = nodes.get(takenEdge.target);
          if (target) {
            trace.push({ nodeId: target.id, viaEdgeId: takenEdge.id });
            contextSnapshots.push(cloneContext(currentContext));
            current = target;
            iterations++;
            continue;
          }
        }
      }

      if (pending && !nextStep) {
        const takenEdge = branchEdge(bySource.get(current.id) ?? [], pending.takenBranch);
        const target = takenEdge ? nodes.get(takenEdge.target) : undefined;
        if (target?.type === 'outcome' && takenEdge) {
          trace.push({ nodeId: target.id, viaEdgeId: takenEdge.id });
          contextSnapshots.push(cloneContext(currentContext));
          return {
            trace,
            contextSnapshots,
            head: { nodeId: target.id, nodeType: 'outcome' },
            pendingDecision: null,
            note: null,
            complete: true,
            reachedOutcomeId: target.id,
          };
        }
      }

      return {
        trace,
        contextSnapshots,
        head: { nodeId: current.id, nodeType: 'decision' },
        pendingDecision: pending,
        note: null,
        complete: false,
        reachedOutcomeId: null,
      };
    }

    if (current.type === 'entry') {
      const edge = (bySource.get(current.id) ?? []).find((e) => e.trigger.type === 'unconditional');
      const target = edge ? nodes.get(edge.target) : undefined;
      if (!edge || !target) {
        return {
          trace,
          contextSnapshots,
          head: { nodeId: current.id, nodeType: current.type },
          pendingDecision: null,
          note: 'no unconditional outgoing edge',
          complete: false,
          reachedOutcomeId: null,
        };
      }
      trace.push({ nodeId: target.id, viaEdgeId: edge.id });
      contextSnapshots.push(cloneContext(currentContext));
      current = target;
      iterations++;
      continue;
    }

    if (scriptQueue.length === 0) {
      return {
        trace,
        contextSnapshots,
        head: { nodeId: current.id, nodeType: current.type },
        pendingDecision: null,
        note: null,
        complete: false,
        reachedOutcomeId: null,
      };
    }

    const step = scriptQueue.shift();
    if (!step) {
      return {
        trace,
        contextSnapshots,
        head: { nodeId: current.id, nodeType: current.type },
        pendingDecision: null,
        note: null,
        complete: false,
        reachedOutcomeId: null,
      };
    }

    lastScriptedStepIndex = draft.inputScript.length - scriptQueue.length - 1;

    if (step.nodeId !== current.id || step.type !== current.type) {
      return {
        trace,
        contextSnapshots,
        head: { nodeId: current.id, nodeType: current.type },
        pendingDecision: null,
        note: 'script mismatch during walk',
        complete: false,
        reachedOutcomeId: null,
      };
    }

    const edge = pickEdgeForStep(bySource.get(current.id) ?? [], step);
    const target = edge ? nodes.get(edge.target) : undefined;
    if (!edge || !target) {
      return {
        trace,
        contextSnapshots,
        head: { nodeId: current.id, nodeType: current.type },
        pendingDecision: null,
        note: 'no matching edge for script step',
        complete: false,
        reachedOutcomeId: null,
      };
    }

    currentContext = applyStepPatch(currentContext, step);
    trace.push({ nodeId: target.id, viaEdgeId: edge.id });
    contextSnapshots.push(cloneContext(currentContext));
    current = target;
    iterations++;
  }

  return {
    trace,
    contextSnapshots,
    head: { nodeId: current.id, nodeType: current.type },
    pendingDecision: null,
    note: 'step-limit-exceeded',
    complete: false,
    reachedOutcomeId: null,
  };
}

function pickEdgeForStep(edges: Edge[], step: ScriptStep): Edge | undefined {
  if (step.type === 'screen') {
    return edges.find((e) => e.trigger.type === 'interaction' && e.trigger.action === step.action);
  }
  const triggerType = `on-${step.result}` as Edge['trigger']['type'];
  return edges.find((e) => e.trigger.type === triggerType);
}

function toScenarioRun(draft: Scenario, walk: WalkResult): ScenarioRun {
  if (walk.complete && walk.reachedOutcomeId) {
    return {
      scenarioId: draft.id,
      trace: walk.trace,
      contextSnapshots: walk.contextSnapshots,
      reachedOutcomeId: walk.reachedOutcomeId,
      status: 'passed',
      divergence: null,
    };
  }

  return {
    scenarioId: draft.id,
    trace: walk.trace,
    contextSnapshots: walk.contextSnapshots,
    reachedOutcomeId: null,
    status: 'diverged',
    divergence: { kind: 'script-exhausted', nodeId: walk.head.nodeId },
  };
}

export function deriveRecording(flow: Flow, draft: Scenario): RecordingModel {
  const walk = recordingWalk(flow, draft);
  const run = toScenarioRun(draft, walk);
  const { steps } = derivePlayerSteps(flowWithDraft(flow, draft), run);
  const headIndex = Math.max(walk.trace.length - 1, 0);
  const contextAtHead = walk.contextSnapshots[headIndex] ?? cloneContext(draft.initialContext);

  return {
    steps,
    head: walk.head,
    pendingDecision: walk.pendingDecision,
    contextAtHead,
    note: walk.note,
  };
}

export function reconcileDraft(
  flow: Flow,
  draft: Scenario,
): { draft: Scenario; note: string | null } {
  const run = runScenario(flow, draft);
  if (run.divergence?.kind !== 'script-mismatch') {
    if (run.divergence?.kind === 'step-limit-exceeded') {
      return { draft, note: 'step-limit-exceeded' };
    }
    return { draft, note: null };
  }

  for (let i = 0; i < draft.inputScript.length; i++) {
    const partial: Scenario = { ...draft, inputScript: draft.inputScript.slice(0, i + 1) };
    const partialRun = runScenario(flow, partial);
    if (partialRun.divergence?.kind === 'script-mismatch') {
      return {
        draft: { ...draft, inputScript: draft.inputScript.slice(0, i) },
        note: 'script tail dropped after edit',
      };
    }
  }

  return {
    draft: { ...draft, inputScript: [] },
    note: 'script tail dropped after edit',
  };
}

function withReconcile(flow: Flow, draft: Scenario): Scenario {
  return reconcileDraft(flow, draft).draft;
}

function maybeSetOutcomeOnHead(flow: Flow, draft: Scenario): Scenario {
  const { head } = deriveRecording(flow, draft);
  if (head.nodeType !== 'outcome') return draft;
  return setExpectedOutcome(draft, head.nodeId);
}

export function appendScreenStep(
  flow: Flow,
  draft: Scenario,
  nodeId: string,
  action: string,
): Scenario {
  const next = withReconcile(flow, {
    ...draft,
    inputScript: [...draft.inputScript, { type: 'screen', nodeId, action }],
  });
  return maybeSetOutcomeOnHead(flow, next);
}

export function appendResolutionStep(
  flow: Flow,
  draft: Scenario,
  nodeId: string,
  result: Extract<ScriptStep, { type: 'action' }>['result'],
  nodeType: 'action' | 'external' = 'action',
): Scenario {
  const step: ScriptStep =
    nodeType === 'external'
      ? { type: 'external', nodeId, result: result as 'success' | 'error' | 'denied' | 'cancelled' }
      : { type: 'action', nodeId, result };
  const next = withReconcile(flow, {
    ...draft,
    inputScript: [...draft.inputScript, step],
  });
  return maybeSetOutcomeOnHead(flow, next);
}

export function editStepChoice(
  flow: Flow,
  draft: Scenario,
  stepIndex: number,
  choice: { action?: string; result?: 'success' | 'error' | 'denied' | 'cancelled' },
): Scenario {
  const script = [...draft.inputScript];
  const step = script[stepIndex];
  if (!step) return draft;

  if (step.type === 'screen' && choice.action !== undefined) {
    script[stepIndex] = { ...step, action: choice.action };
  } else if (step.type === 'action' && choice.result !== undefined) {
    script[stepIndex] = { ...step, result: choice.result as 'success' | 'error' };
  } else if (step.type === 'external' && choice.result !== undefined) {
    script[stepIndex] = {
      ...step,
      result: choice.result as 'success' | 'error' | 'denied' | 'cancelled',
    };
  }

  return withReconcile(flow, { ...draft, inputScript: script });
}

export function setStepPatch(
  flow: Flow,
  draft: Scenario,
  stepIndex: number,
  slot: string,
  value: unknown,
): Scenario {
  const script = [...draft.inputScript];
  const step = script[stepIndex];
  if (!step) return draft;
  script[stepIndex] = { ...step, set: { ...step.set, [slot]: value } };
  return maybeSetOutcomeOnHead(flow, withReconcile(flow, { ...draft, inputScript: script }));
}

export function clearStepPatch(
  flow: Flow,
  draft: Scenario,
  stepIndex: number,
  slot: string,
): Scenario {
  const script = [...draft.inputScript];
  const step = script[stepIndex];
  if (!step?.set || !(slot in step.set)) return draft;
  const rest = { ...step.set };
  delete rest[slot];
  const nextSet = Object.keys(rest).length > 0 ? rest : undefined;
  script[stepIndex] = { ...step, set: nextSet };
  return withReconcile(flow, { ...draft, inputScript: script });
}

export function deleteFromStep(flow: Flow, draft: Scenario, stepIndex: number): Scenario {
  return withReconcile(flow, {
    ...draft,
    inputScript: draft.inputScript.slice(0, stepIndex),
  });
}

export function setExpectedOutcome(draft: Scenario, outcomeId: string): Scenario {
  return {
    ...draft,
    expectedOutcome: { outcomeId },
  };
}

export function clearExpectedOutcome(draft: Scenario): Scenario {
  const next = { ...draft };
  delete next.expectedOutcome;
  return next;
}

export function applyBranchFix(
  flow: Flow,
  draft: Scenario,
  fix: BranchFix,
  value?: unknown,
): Scenario {
  let next = draft;

  if (fix.kind === 'initial-context') {
    next = {
      ...draft,
      initialContext: { ...draft.initialContext, [fix.slot]: fix.value },
    };
  } else if (fix.kind === 'step-patch') {
    const script = [...draft.inputScript];
    const step = script[fix.stepIndex];
    if (!step) return draft;
    script[fix.stepIndex] = { ...step, set: { ...step.set, [fix.slot]: fix.value } };
    next = { ...draft, inputScript: script };
  } else if (fix.kind === 'needs-value' && value !== undefined) {
    next = {
      ...draft,
      initialContext: { ...draft.initialContext, [fix.slot]: value },
    };
  }

  return maybeSetOutcomeOnHead(flow, withReconcile(flow, next));
}

export function setInitialContextValue(
  flow: Flow,
  draft: Scenario,
  slot: string,
  value: unknown,
): Scenario {
  return withReconcile(flow, {
    ...draft,
    initialContext: { ...draft.initialContext, [slot]: value },
  });
}
