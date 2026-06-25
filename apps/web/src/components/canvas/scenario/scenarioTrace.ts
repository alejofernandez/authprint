// Scenario trace styling (US-061) — derives per-node / per-edge presentation
// from `{ run, stepIndex }`, mirroring E33's validation attachment pattern.

import type { Divergence, ScenarioRun } from '@authprint/dsl';
import { clampStepIndex } from './useScenarioRun.ts';

export type TraceNodeState = 'active' | 'visited' | 'diverged';
export type TraceEdgeState = 'active' | 'diverged';

export type TraceAttachment = {
  byNode: Map<string, TraceNodeState>;
  byEdge: Map<string, TraceEdgeState>;
  /** Divergence reason keyed by node id (tooltip on the deviation point). */
  tooltips: Map<string, string>;
};

const ACTIVE_RING =
  'ring-2 ring-indigo-500 ring-offset-2 ring-offset-zinc-50 dark:ring-offset-zinc-950';
const DIVERGED_RING =
  'ring-2 ring-red-500 ring-offset-2 ring-offset-zinc-50 dark:ring-offset-zinc-950';

export function traceRing(state: TraceNodeState | undefined): string {
  if (state === 'active') return ACTIVE_RING;
  if (state === 'diverged') return DIVERGED_RING;
  return '';
}

export function traceOpacity(state: TraceNodeState | undefined): string {
  return state === 'visited' ? 'opacity-45 saturate-50' : '';
}

export function formatDivergence(divergence: Divergence): string {
  switch (divergence.kind) {
    case 'no-matching-edge':
      return `No matching edge at ${divergence.nodeId}: ${divergence.detail}`;
    case 'script-mismatch':
      return `Script mismatch at ${divergence.nodeId}: ${divergence.detail}`;
    case 'script-exhausted':
      return `Script exhausted at ${divergence.nodeId}`;
    case 'unknown-slot':
      return `Unknown context slot "${divergence.slot}" at ${divergence.nodeId}`;
    case 'predicate-type-error':
      return `Predicate type error at ${divergence.nodeId}: ${divergence.detail}`;
    case 'unexpected-outcome':
      return `Unexpected outcome at ${divergence.nodeId}: expected ${divergence.expected}, got ${divergence.actual}`;
    case 'sequence-mismatch':
      return `Sequence mismatch at step ${divergence.atIndex}: expected ${divergence.expected}, got ${divergence.actual}`;
    case 'step-limit-exceeded':
      return `Step limit exceeded at ${divergence.nodeId}`;
  }
}

function divergenceNodeId(divergence: Divergence): string | null {
  if (divergence.kind === 'sequence-mismatch') return null;
  return divergence.nodeId;
}

/** Build trace styling maps from the active scenario run + playback cursor. */
export function buildTraceAttachment(run: ScenarioRun, stepIndex: number): TraceAttachment {
  const byNode = new Map<string, TraceNodeState>();
  const byEdge = new Map<string, TraceEdgeState>();
  const tooltips = new Map<string, string>();

  const { trace } = run;
  if (trace.length === 0) return { byNode, byEdge, tooltips };

  const index = clampStepIndex(stepIndex, trace.length);
  const atEnd = index >= trace.length - 1;
  const showDivergence = run.status === 'diverged' && run.divergence !== null && atEnd;
  const divergenceNode = showDivergence && run.divergence ? divergenceNodeId(run.divergence) : null;

  for (let i = 0; i < index; i++) {
    byNode.set(trace[i]?.nodeId ?? '', 'visited');
  }

  const active = trace[index];
  if (active) {
    if (showDivergence && divergenceNode === active.nodeId) {
      byNode.set(active.nodeId, 'diverged');
      if (run.divergence) tooltips.set(active.nodeId, formatDivergence(run.divergence));
      if (active.viaEdgeId) byEdge.set(active.viaEdgeId, 'diverged');
    } else {
      byNode.set(active.nodeId, 'active');
      if (active.viaEdgeId) byEdge.set(active.viaEdgeId, 'active');
    }
  }

  if (showDivergence && divergenceNode && divergenceNode !== active?.nodeId) {
    byNode.set(divergenceNode, 'diverged');
    if (run.divergence) tooltips.set(divergenceNode, formatDivergence(run.divergence));
    const last = trace[trace.length - 1];
    if (last?.nodeId === divergenceNode && last.viaEdgeId) {
      byEdge.set(last.viaEdgeId, 'diverged');
    }
  }

  return { byNode, byEdge, tooltips };
}

/** Context slots referenced by a divergence, for the Context panel (US-062). */
export function divergenceContextSlots(divergence: Divergence | null): ReadonlySet<string> {
  if (!divergence) return new Set();
  if (divergence.kind === 'unknown-slot') return new Set([divergence.slot]);
  return new Set();
}
