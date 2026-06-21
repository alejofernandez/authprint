// US-022 — Reference integrity: every id reference points at a real node /
// edge / outcome of the expected type.

import type { Diagnostic } from '../diagnostic.ts';
import type { Flow } from '../schema/flow.ts';
import type { Node } from '../schema/node.ts';

export function checkReferences(flow: Flow): Diagnostic[] {
  const nodeById = new Map(flow.nodes.map((n) => [n.id, n] as const));
  const edgeIds = new Set(flow.edges.map((e) => e.id));

  return [
    ...checkEdgeReferences(flow, nodeById),
    ...checkAnnotationReferences(flow, nodeById, edgeIds),
    ...checkScenarioReferences(flow, nodeById),
  ];
}

// ─── Edge source / target ───────────────────────────────────────────────────

function checkEdgeReferences(flow: Flow, nodeById: Map<string, Node>): Diagnostic[] {
  const out: Diagnostic[] = [];

  for (const [idx, edge] of flow.edges.entries()) {
    if (!nodeById.has(edge.source)) {
      out.push({
        severity: 'error',
        code: 'validation-edge-source-not-found',
        message: `edge '${edge.id}' source '${edge.source}' does not resolve to any node`,
        path: `edges[${idx}].source`,
      });
    }
    if (!nodeById.has(edge.target)) {
      out.push({
        severity: 'error',
        code: 'validation-edge-target-not-found',
        message: `edge '${edge.id}' target '${edge.target}' does not resolve to any node`,
        path: `edges[${idx}].target`,
      });
    }
  }

  return out;
}

// ─── Annotation attachments ─────────────────────────────────────────────────

function checkAnnotationReferences(
  flow: Flow,
  nodeById: Map<string, Node>,
  edgeIds: Set<string>,
): Diagnostic[] {
  const out: Diagnostic[] = [];

  for (const [idx, ann] of flow.annotations.entries()) {
    if (ann.attachment.type === 'node' && !nodeById.has(ann.attachment.nodeId)) {
      out.push({
        severity: 'error',
        code: 'validation-annotation-node-not-found',
        message: `annotation '${ann.id}' references node '${ann.attachment.nodeId}' which does not exist`,
        path: `annotations[${idx}].attachment.nodeId`,
      });
    }
    if (ann.attachment.type === 'edge' && !edgeIds.has(ann.attachment.edgeId)) {
      out.push({
        severity: 'error',
        code: 'validation-annotation-edge-not-found',
        message: `annotation '${ann.id}' references edge '${ann.attachment.edgeId}' which does not exist`,
        path: `annotations[${idx}].attachment.edgeId`,
      });
    }
    // floating: nothing to resolve
  }

  return out;
}

// ─── Scenario script + expected outcome ─────────────────────────────────────

function checkScenarioReferences(flow: Flow, nodeById: Map<string, Node>): Diagnostic[] {
  const out: Diagnostic[] = [];

  for (const [sIdx, scenario] of flow.scenarios.entries()) {
    // Input script: each step's nodeId resolves AND node type matches step type.
    for (const [stepIdx, step] of scenario.inputScript.entries()) {
      const node = nodeById.get(step.nodeId);
      if (!node) {
        out.push({
          severity: 'error',
          code: 'validation-scenario-step-node-not-found',
          message: `scenario '${scenario.id}' step ${stepIdx} references node '${step.nodeId}' which does not exist`,
          path: `scenarios[${sIdx}].inputScript[${stepIdx}].nodeId`,
        });
        continue;
      }
      if (node.type !== step.type) {
        out.push({
          severity: 'error',
          code: 'validation-scenario-step-type-mismatch',
          message: `scenario '${scenario.id}' step ${stepIdx} is typed '${step.type}' but node '${step.nodeId}' is a '${node.type}'`,
          path: `scenarios[${sIdx}].inputScript[${stepIdx}]`,
        });
      }
    }

    // Expected outcome assertions.
    if (scenario.expectedOutcome) {
      const { outcomeId, sequence } = scenario.expectedOutcome;
      if (outcomeId !== undefined) {
        const node = nodeById.get(outcomeId);
        if (!node || node.type !== 'outcome') {
          out.push({
            severity: 'error',
            code: 'validation-scenario-outcome-not-found',
            message: `scenario '${scenario.id}' expectedOutcome.outcomeId '${outcomeId}' does not resolve to an outcome node`,
            path: `scenarios[${sIdx}].expectedOutcome.outcomeId`,
          });
        }
      }
      if (sequence !== undefined) {
        for (const [seqIdx, nodeId] of sequence.entries()) {
          if (!nodeById.has(nodeId)) {
            out.push({
              severity: 'error',
              code: 'validation-scenario-sequence-node-not-found',
              message: `scenario '${scenario.id}' expectedOutcome.sequence[${seqIdx}] '${nodeId}' does not resolve to any node`,
              path: `scenarios[${sIdx}].expectedOutcome.sequence[${seqIdx}]`,
            });
          }
        }
      }
    }
  }

  return out;
}
