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
import { evaluatePredicate } from '@authprint/dsl';
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
  /**
   * True when current context determines the branch. False (unevaluable slot)
   * means takenBranch/otherBranch are placeholders: the walk must pause here —
   * never auto-complete, auto-traverse, or accept a Continue — and the UI asks
   * for a value instead of offering Continue (a branch walked without context
   * support would diverge on replay).
   */
  dictated: boolean;
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
      dictated: false,
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
    dictated: true,
    takenBranch,
    takenDestinationId: takenEdge.target,
    otherBranch,
    otherDestinationId: otherEdge.target,
    fixes,
  };
}

export type DeriveRecordingOptions = {
  /**
   * Session-ephemeral Continue confirmations (US-120). Decisions aren't script
   * steps — Continue advances past a pause without mutating the Scenario.
   */
  confirmedDecisionIds?: ReadonlySet<string>;
};

/** Recording walk — pauses at decisions (§7) and script-exhausted nodes. */
function recordingWalk(
  flow: Flow,
  draft: Scenario,
  options: DeriveRecordingOptions = {},
): WalkResult {
  const confirmed = options.confirmedDecisionIds;
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
      if (pending?.dictated && nextStep) {
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

      if (pending?.dictated && !nextStep) {
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
        // US-120 Continue: author accepted the context-dictated branch.
        if (takenEdge && target && confirmed?.has(current.id)) {
          trace.push({ nodeId: target.id, viaEdgeId: takenEdge.id });
          contextSnapshots.push(cloneContext(currentContext));
          current = target;
          iterations++;
          continue;
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

export function deriveRecording(
  flow: Flow,
  draft: Scenario,
  options: DeriveRecordingOptions = {},
): RecordingModel {
  const walk = recordingWalk(flow, draft, options);
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

/**
 * The decision card for a mid-trace decision (UF-024): the same branch fixes
 * the head pause offers, derived from the context the walk had at that point.
 * Forcing a branch from the filmstrip beats hunting for the earlier step
 * whose patch happens to flip it.
 */
export function pendingDecisionAt(
  flow: Flow,
  draft: Scenario,
  traceIndex: number,
): { pending: PendingDecision; context: Record<string, unknown> } | null {
  const walk = recordingWalk(flow, draft);
  const entry = walk.trace[traceIndex];
  if (!entry) return null;
  const nodes = nodeById(flow);
  const node = nodes.get(entry.nodeId);
  if (node?.type !== 'decision') return null;

  const context = walk.contextSnapshots[traceIndex] ?? cloneContext(draft.initialContext);
  // Every screen/action/external strictly before a mid-trace decision consumed
  // one script step, so the count maps trace position to script position.
  let scriptedBefore = 0;
  for (let i = 0; i < traceIndex; i++) {
    const prior = walk.trace[i];
    const priorNode = prior ? nodes.get(prior.nodeId) : undefined;
    if (
      priorNode &&
      (priorNode.type === 'screen' || priorNode.type === 'action' || priorNode.type === 'external')
    ) {
      scriptedBefore++;
    }
  }
  const pending = buildPendingDecision(
    flow,
    node,
    context,
    scriptedBefore > 0 ? scriptedBefore - 1 : null,
  );
  if (!pending) return null;
  return { pending, context };
}

export function reconcileDraft(
  flow: Flow,
  draft: Scenario,
): { draft: Scenario; note: string | null } {
  // Tail-drop is defined by what the recording walk can actually consume, not
  // by a divergence kind: a rerouted trace can reach a different outcome with
  // leftover script and never emit script-mismatch (UF-031). One exception
  // keeps the tail: an undictated decision pause is a temporarily un-walkable
  // state, and re-setting the missing value must restore the script intact.
  const walk = recordingWalk(flow, draft);
  if (walk.note === 'step-limit-exceeded') {
    return { draft, note: 'step-limit-exceeded' };
  }

  const nodes = nodeById(flow);
  let consumed = 0;
  for (let i = 0; i < walk.trace.length - 1; i++) {
    const node = nodes.get(walk.trace[i]?.nodeId ?? '');
    if (node && (node.type === 'screen' || node.type === 'action' || node.type === 'external')) {
      consumed++;
    }
  }

  if (consumed >= draft.inputScript.length) {
    return { draft, note: null };
  }
  if (walk.pendingDecision && !walk.pendingDecision.dictated) {
    return { draft, note: null };
  }
  return {
    draft: { ...draft, inputScript: draft.inputScript.slice(0, consumed) },
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
  result: Extract<ScriptStep, { type: 'action' | 'external' }>['result'],
  nodeType: 'action' | 'external' = 'action',
): Scenario {
  const step: ScriptStep =
    nodeType === 'external'
      ? { type: 'external', nodeId, result: result as 'success' | 'error' | 'denied' | 'cancelled' }
      : { type: 'action', nodeId, result: result as 'success' | 'error' };
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

export function clearInitialContextValue(flow: Flow, draft: Scenario, slot: string): Scenario {
  if (!(slot in draft.initialContext)) return draft;
  const next = { ...draft.initialContext };
  delete next[slot];
  return maybeSetOutcomeOnHead(flow, withReconcile(flow, { ...draft, initialContext: next }));
}

export function setInitialContextValue(
  flow: Flow,
  draft: Scenario,
  slot: string,
  value: unknown,
): Scenario {
  return maybeSetOutcomeOnHead(
    flow,
    withReconcile(flow, {
      ...draft,
      initialContext: { ...draft.initialContext, [slot]: value },
    }),
  );
}
