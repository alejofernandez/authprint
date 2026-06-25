// US-059 — Scenario walk-through interpreter (model checking, not execution).

import type { Edge } from '../schema/edge.ts';
import type { Flow } from '../schema/flow.ts';
import type { Node } from '../schema/node.ts';
import type { ContextSlot, Predicate } from '../schema/predicate.ts';
import type { Scenario, ScriptStep } from '../schema/scenario.ts';

export type TraceStep = { nodeId: string; viaEdgeId: string | null };

export type Divergence =
  | { kind: 'no-matching-edge'; nodeId: string; detail: string }
  | { kind: 'script-mismatch'; nodeId: string; detail: string }
  | { kind: 'script-exhausted'; nodeId: string }
  | { kind: 'unknown-slot'; nodeId: string; slot: string }
  | { kind: 'predicate-type-error'; nodeId: string; detail: string }
  | { kind: 'unexpected-outcome'; nodeId: string; expected: string; actual: string }
  | { kind: 'sequence-mismatch'; atIndex: number; expected: string; actual: string }
  | { kind: 'step-limit-exceeded'; nodeId: string };

export type ScenarioRun = {
  scenarioId: string;
  trace: TraceStep[];
  reachedOutcomeId: string | null;
  status: 'passed' | 'diverged';
  divergence: Divergence | null;
};

type TransitionResult =
  | { ok: true; edge: Edge; target: Node }
  | { ok: false; divergence: Divergence };

export function runScenario(flow: Flow, scenario: Scenario): ScenarioRun {
  const entry = flow.nodes.find((n) => n.type === 'entry');
  if (!entry) {
    return divergedRun(scenario.id, [], null, {
      kind: 'no-matching-edge',
      nodeId: '',
      detail: 'flow has no entry node',
    });
  }

  const nodeById = indexNodesById(flow.nodes);
  const edgesBySource = indexEdgesBySource(flow.edges);
  const scriptQueue = [...scenario.inputScript];
  const maxSteps = flow.nodes.length * 8;

  const trace: TraceStep[] = [{ nodeId: entry.id, viaEdgeId: null }];
  let current: Node = entry;
  let iterations = 1;

  while (true) {
    if (iterations > maxSteps) {
      return divergedRun(scenario.id, trace, null, {
        kind: 'step-limit-exceeded',
        nodeId: current.id,
      });
    }

    if (current.type === 'outcome') {
      return finishAtOutcome(scenario, trace, current.id);
    }

    const transition = transitionFrom(
      flow,
      current,
      scriptQueue,
      edgesBySource,
      nodeById,
      scenario.initialContext,
    );
    if (!transition.ok) {
      return divergedRun(scenario.id, trace, null, transition.divergence);
    }

    trace.push({ nodeId: transition.target.id, viaEdgeId: transition.edge.id });
    current = transition.target;
    iterations++;
  }
}

function finishAtOutcome(scenario: Scenario, trace: TraceStep[], outcomeId: string): ScenarioRun {
  const expected = scenario.expectedOutcome;
  if (!expected) {
    return passedRun(scenario.id, trace, outcomeId);
  }

  if (expected.outcomeId !== undefined && expected.outcomeId !== outcomeId) {
    return divergedRun(scenario.id, trace, outcomeId, {
      kind: 'unexpected-outcome',
      nodeId: outcomeId,
      expected: expected.outcomeId,
      actual: outcomeId,
    });
  }

  if (expected.sequence !== undefined) {
    const actualSequence = trace.map((s) => s.nodeId);
    const limit = Math.max(expected.sequence.length, actualSequence.length);
    for (let i = 0; i < limit; i++) {
      const want = expected.sequence[i] ?? '';
      const got = actualSequence[i] ?? '';
      if (got !== want) {
        return divergedRun(scenario.id, trace, outcomeId, {
          kind: 'sequence-mismatch',
          atIndex: i,
          expected: want,
          actual: got,
        });
      }
    }
  }

  return passedRun(scenario.id, trace, outcomeId);
}

function transitionFrom(
  flow: Flow,
  node: Node,
  scriptQueue: ScriptStep[],
  edgesBySource: Map<string, Edge[]>,
  nodeById: Map<string, Node>,
  initialContext: Record<string, unknown>,
): TransitionResult {
  switch (node.type) {
    case 'entry':
      return followUnconditional(node, edgesBySource, nodeById);
    case 'decision':
      return followDecision(flow, node, edgesBySource, nodeById, initialContext);
    case 'screen': {
      const result = consumeScriptStep(node, scriptQueue, 'screen', (step) =>
        findInteractionEdge(edgesBySource.get(node.id) ?? [], step.action),
      );
      if (!result.ok) return result;
      return edgeToTransition(result.edge, nodeById);
    }
    case 'action': {
      const result = consumeScriptStep(node, scriptQueue, 'action', (step) =>
        findResultEdge(edgesBySource.get(node.id) ?? [], step.result, ['on-success', 'on-error']),
      );
      if (!result.ok) return result;
      return edgeToTransition(result.edge, nodeById);
    }
    case 'external': {
      const result = consumeScriptStep(node, scriptQueue, 'external', (step) =>
        findResultEdge(edgesBySource.get(node.id) ?? [], step.result, [
          'on-success',
          'on-error',
          'on-denied',
          'on-cancelled',
        ]),
      );
      if (!result.ok) return result;
      return edgeToTransition(result.edge, nodeById);
    }
    case 'outcome':
      return {
        ok: false,
        divergence: {
          kind: 'no-matching-edge',
          nodeId: node.id,
          detail: 'outcome nodes have no outgoing edges',
        },
      };
  }
}

function followUnconditional(
  node: Node,
  edgesBySource: Map<string, Edge[]>,
  nodeById: Map<string, Node>,
): TransitionResult {
  const edges = edgesBySource.get(node.id) ?? [];
  const edge = edges.find((e) => e.trigger.type === 'unconditional');
  if (!edge) {
    return {
      ok: false,
      divergence: {
        kind: 'no-matching-edge',
        nodeId: node.id,
        detail: 'no unconditional outgoing edge',
      },
    };
  }
  return edgeToTransition(edge, nodeById);
}

function followDecision(
  flow: Flow,
  node: Extract<Node, { type: 'decision' }>,
  edgesBySource: Map<string, Edge[]>,
  nodeById: Map<string, Node>,
  initialContext: Record<string, unknown>,
): TransitionResult {
  const evalResult = evaluatePredicate(flow, node.id, node.predicate, initialContext);
  if (evalResult.kind === 'error') {
    return { ok: false, divergence: evalResult.divergence };
  }

  const edges = edgesBySource.get(node.id) ?? [];
  const edge = edges.find(
    (e) => e.trigger.type === 'branch' && e.trigger.value === evalResult.value,
  );
  if (!edge) {
    return {
      ok: false,
      divergence: {
        kind: 'no-matching-edge',
        nodeId: node.id,
        detail: `no branch edge for predicate result ${String(evalResult.value)}`,
      },
    };
  }
  return edgeToTransition(edge, nodeById);
}

type ScriptStepResult = { ok: true; edge: Edge } | { ok: false; divergence: Divergence };

function consumeScriptStep<T extends ScriptStep['type']>(
  node: Node,
  scriptQueue: ScriptStep[],
  expectedType: T,
  pickEdge: (step: Extract<ScriptStep, { type: T }>) => Edge | null,
): ScriptStepResult {
  if (scriptQueue.length === 0) {
    return { ok: false, divergence: { kind: 'script-exhausted', nodeId: node.id } };
  }

  const step = scriptQueue.shift();
  if (!step) {
    return { ok: false, divergence: { kind: 'script-exhausted', nodeId: node.id } };
  }
  if (step.nodeId !== node.id || step.type !== expectedType) {
    return {
      ok: false,
      divergence: {
        kind: 'script-mismatch',
        nodeId: node.id,
        detail: `expected ${expectedType} step at '${node.id}', got ${step.type} at '${step.nodeId}'`,
      },
    };
  }

  const edge = pickEdge(step as Extract<ScriptStep, { type: T }>);
  if (!edge) {
    const detail =
      step.type === 'screen'
        ? `no interaction edge for action '${step.action}'`
        : `no edge for result '${step.result}'`;
    return {
      ok: false,
      divergence: { kind: 'no-matching-edge', nodeId: node.id, detail },
    };
  }
  return { ok: true, edge };
}

function findInteractionEdge(edges: Edge[], action: string): Edge | null {
  return edges.find((e) => e.trigger.type === 'interaction' && e.trigger.action === action) ?? null;
}

function findResultEdge(
  edges: Edge[],
  result: string,
  allowed: readonly Edge['trigger']['type'][],
): Edge | null {
  const triggerType = `on-${result}` as Edge['trigger']['type'];
  if (!allowed.includes(triggerType)) return null;
  return edges.find((e) => e.trigger.type === triggerType) ?? null;
}

function evaluatePredicate(
  flow: Flow,
  nodeId: string,
  predicate: Predicate,
  initialContext: Record<string, unknown>,
): { kind: 'ok'; value: boolean } | { kind: 'error'; divergence: Divergence } {
  const slotDecl = flow.context[predicate.slot] as ContextSlot | undefined;
  if (!slotDecl) {
    return {
      kind: 'error',
      divergence: { kind: 'unknown-slot', nodeId, slot: predicate.slot },
    };
  }
  if (!(predicate.slot in initialContext)) {
    return {
      kind: 'error',
      divergence: { kind: 'unknown-slot', nodeId, slot: predicate.slot },
    };
  }

  const slotValue = initialContext[predicate.slot];

  if (predicate.op === 'in' || predicate.op === 'not-in') {
    if (!Array.isArray(predicate.value)) {
      return {
        kind: 'error',
        divergence: {
          kind: 'predicate-type-error',
          nodeId,
          detail: `predicate value must be an array for op '${predicate.op}'`,
        },
      };
    }
    const member = predicate.value.some((item) => item === slotValue);
    return { kind: 'ok', value: predicate.op === 'in' ? member : !member };
  }

  const numericOps = [
    'greater-than',
    'less-than',
    'greater-than-or-equal',
    'less-than-or-equal',
  ] as const;
  if (numericOps.includes(predicate.op as (typeof numericOps)[number])) {
    if (typeof slotValue !== 'number' || !Number.isFinite(slotValue)) {
      return {
        kind: 'error',
        divergence: {
          kind: 'predicate-type-error',
          nodeId,
          detail: `slot '${predicate.slot}' is not a number`,
        },
      };
    }
    if (typeof predicate.value !== 'number' || !Number.isFinite(predicate.value)) {
      return {
        kind: 'error',
        divergence: {
          kind: 'predicate-type-error',
          nodeId,
          detail: 'predicate value is not a number',
        },
      };
    }
    const n = slotValue;
    const v = predicate.value;
    switch (predicate.op) {
      case 'greater-than':
        return { kind: 'ok', value: n > v };
      case 'less-than':
        return { kind: 'ok', value: n < v };
      case 'greater-than-or-equal':
        return { kind: 'ok', value: n >= v };
      case 'less-than-or-equal':
        return { kind: 'ok', value: n <= v };
    }
  }

  if (predicate.op === 'equals') {
    return { kind: 'ok', value: slotValue === predicate.value };
  }
  if (predicate.op === 'not-equals') {
    return { kind: 'ok', value: slotValue !== predicate.value };
  }

  return {
    kind: 'error',
    divergence: {
      kind: 'predicate-type-error',
      nodeId,
      detail: `unsupported op '${predicate.op}'`,
    },
  };
}

function indexNodesById(nodes: Node[]): Map<string, Node> {
  return new Map(nodes.map((n) => [n.id, n]));
}

function indexEdgesBySource(edges: Edge[]): Map<string, Edge[]> {
  const map = new Map<string, Edge[]>();
  for (const edge of edges) {
    const list = map.get(edge.source) ?? [];
    list.push(edge);
    map.set(edge.source, list);
  }
  return map;
}

function edgeToTransition(edge: Edge, nodeById: Map<string, Node>): TransitionResult {
  const target = nodeById.get(edge.target);
  if (!target) {
    return {
      ok: false,
      divergence: {
        kind: 'no-matching-edge',
        nodeId: edge.source,
        detail: `edge '${edge.id}' targets unknown node '${edge.target}'`,
      },
    };
  }
  return { ok: true, edge, target };
}

function passedRun(scenarioId: string, trace: TraceStep[], outcomeId: string): ScenarioRun {
  return {
    scenarioId,
    trace,
    reachedOutcomeId: outcomeId,
    status: 'passed',
    divergence: null,
  };
}

function divergedRun(
  scenarioId: string,
  trace: TraceStep[],
  outcomeId: string | null,
  divergence: Divergence,
): ScenarioRun {
  return {
    scenarioId,
    trace,
    reachedOutcomeId: outcomeId,
    status: 'diverged',
    divergence,
  };
}
