// US-021 — Edge completeness checks: per-source-type outgoing-edge
// requirements + outcome terminality + trigger-by-source compatibility.

import type { Diagnostic } from '../diagnostic.ts';
import type { Edge } from '../schema/edge.ts';
import { validateEdgeTrigger } from '../schema/edge.ts';
import type { Flow } from '../schema/flow.ts';
import type { Node } from '../schema/node.ts';

export function checkEdgeCompleteness(flow: Flow): Diagnostic[] {
  const nodeById = new Map(flow.nodes.map((n) => [n.id, n] as const));

  return [
    ...checkDecisionBranches(flow, nodeById),
    ...checkActionResultEdges(flow, nodeById),
    ...checkExternalResultEdges(flow, nodeById),
    ...checkOutcomeNoOutgoingEdges(flow, nodeById),
    ...checkTriggerCompatibility(flow, nodeById),
    ...checkDuplicateScreenInteractions(flow, nodeById),
  ];
}

// ─── Decision branches ──────────────────────────────────────────────────────
// v1 single-boolean-predicate: exactly two outgoing `branch` edges with
// `value: true` and `value: false`.

function checkDecisionBranches(flow: Flow, nodeById: Map<string, Node>): Diagnostic[] {
  const out: Diagnostic[] = [];

  for (const [idx, node] of flow.nodes.entries()) {
    if (node.type !== 'decision') continue;

    const branches = flow.edges.filter((e) => e.source === node.id && e.trigger.type === 'branch');

    const seenValues = new Set<boolean>();
    for (const edge of branches) {
      if (edge.trigger.type === 'branch') {
        seenValues.add(edge.trigger.value);
      }
    }

    if (!seenValues.has(true)) {
      out.push({
        severity: 'error',
        code: 'validation-decision-branch-missing',
        message: `decision '${node.id}' is missing branch for value=true`,
        path: `nodes[${idx}]`,
        target: { kind: 'node', id: node.id },
      });
    }
    if (!seenValues.has(false)) {
      out.push({
        severity: 'error',
        code: 'validation-decision-branch-missing',
        message: `decision '${node.id}' is missing branch for value=false`,
        path: `nodes[${idx}]`,
        target: { kind: 'node', id: node.id },
      });
    }
    if (branches.length > 2) {
      const extras = branches.length - 2;
      out.push({
        severity: 'error',
        code: 'validation-decision-branch-extra',
        message: `decision '${node.id}' has ${branches.length} branches (v1 expects exactly 2 for boolean predicates); ${extras} extra`,
        path: `nodes[${idx}]`,
        target: { kind: 'node', id: node.id },
      });
    }
  }

  // nodeById not directly used here, but accepted for symmetry with the other
  // checks (and as a defensive guard against schema drift in the future).
  void nodeById;

  return out;
}

// ─── Action result edges (success + error required) ─────────────────────────

function checkActionResultEdges(flow: Flow, nodeById: Map<string, Node>): Diagnostic[] {
  void nodeById;
  const out: Diagnostic[] = [];

  for (const [idx, node] of flow.nodes.entries()) {
    if (node.type !== 'action') continue;

    const outgoing = flow.edges.filter((e) => e.source === node.id);
    const hasSuccess = outgoing.some((e) => e.trigger.type === 'on-success');
    const hasError = outgoing.some((e) => e.trigger.type === 'on-error');

    if (!hasSuccess) {
      out.push({
        severity: 'error',
        code: 'validation-action-missing-success-edge',
        message: `action '${node.id}' is missing an on-success outgoing edge`,
        path: `nodes[${idx}]`,
        target: { kind: 'node', id: node.id },
      });
    }
    if (!hasError) {
      out.push({
        severity: 'error',
        code: 'validation-action-missing-error-edge',
        message: `action '${node.id}' is missing an on-error outgoing edge`,
        path: `nodes[${idx}]`,
        target: { kind: 'node', id: node.id },
      });
    }
  }

  return out;
}

// ─── External result edges (success + error required minimum) ───────────────

function checkExternalResultEdges(flow: Flow, nodeById: Map<string, Node>): Diagnostic[] {
  void nodeById;
  const out: Diagnostic[] = [];

  for (const [idx, node] of flow.nodes.entries()) {
    if (node.type !== 'external') continue;

    const outgoing = flow.edges.filter((e) => e.source === node.id);
    const hasSuccess = outgoing.some((e) => e.trigger.type === 'on-success');
    const hasError = outgoing.some((e) => e.trigger.type === 'on-error');

    if (!hasSuccess) {
      out.push({
        severity: 'error',
        code: 'validation-external-missing-success-edge',
        message: `external '${node.id}' is missing an on-success outgoing edge`,
        path: `nodes[${idx}]`,
        target: { kind: 'node', id: node.id },
      });
    }
    if (!hasError) {
      out.push({
        severity: 'error',
        code: 'validation-external-missing-error-edge',
        message: `external '${node.id}' is missing an on-error outgoing edge`,
        path: `nodes[${idx}]`,
        target: { kind: 'node', id: node.id },
      });
    }
  }

  return out;
}

// ─── Outcome terminality (no outgoing edges) ────────────────────────────────

function checkOutcomeNoOutgoingEdges(flow: Flow, nodeById: Map<string, Node>): Diagnostic[] {
  void nodeById;
  const out: Diagnostic[] = [];
  const outcomeIds = new Set(flow.nodes.filter((n) => n.type === 'outcome').map((n) => n.id));

  for (const [eIdx, edge] of flow.edges.entries()) {
    if (outcomeIds.has(edge.source)) {
      out.push({
        severity: 'error',
        code: 'validation-outcome-has-outgoing-edge',
        message: `outcome '${edge.source}' has an outgoing edge to '${edge.target}'`,
        path: `edges[${eIdx}]`,
        target: { kind: 'edge', id: edge.id },
      });
    }
  }

  return out;
}

// ─── Trigger-by-source compatibility (flow-wide) ────────────────────────────

function checkTriggerCompatibility(flow: Flow, nodeById: Map<string, Node>): Diagnostic[] {
  const out: Diagnostic[] = [];

  for (const [eIdx, edge] of flow.edges.entries()) {
    const source = nodeById.get(edge.source);
    if (!source) continue; // reference-integrity check (US-022) flags this

    const err = validateEdgeTrigger(edge as Edge, source.type);
    if (err !== null) {
      out.push({
        severity: 'error',
        code: 'validation-trigger-incompatible-with-source',
        message: err.reason,
        path: `edges[${eIdx}].trigger`,
        target: { kind: 'edge', id: edge.id },
      });
    }
  }

  return out;
}

// ─── Duplicate screen interactions ────────────────────────────────────────────
// One outgoing edge per distinct user action on a Screen (valid by construction
// in the editor; this catches hand-authored files).

function checkDuplicateScreenInteractions(flow: Flow, nodeById: Map<string, Node>): Diagnostic[] {
  void nodeById;
  const out: Diagnostic[] = [];

  for (const [idx, node] of flow.nodes.entries()) {
    if (node.type !== 'screen') continue;

    const seen = new Map<string, number>();
    for (const edge of flow.edges) {
      if (edge.source !== node.id || edge.trigger.type !== 'interaction') continue;
      const action = edge.trigger.action;
      seen.set(action, (seen.get(action) ?? 0) + 1);
    }

    for (const [action, count] of seen) {
      if (count <= 1) continue;
      out.push({
        severity: 'error',
        code: 'validation-screen-duplicate-interaction',
        message: `screen '${node.id}' has ${count} outgoing edges for interaction '${action}' (expected at most one per action)`,
        path: `nodes[${idx}]`,
        target: { kind: 'node', id: node.id },
      });
    }
  }

  return out;
}
