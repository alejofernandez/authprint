// Live structural validation (E33 / US-056). Runs the existing
// `validate(flow)` (E2) over the Y.Doc-derived flow as it changes and groups the
// diagnostics by the node / edge they target (US-055) so the canvas can ring the
// offending elements and a Problems panel can list everything.
//
// `validate` is pure graph checks — fast for the v1 graph sizes — so we recompute
// on every flow change with no debounce. The pure `computeValidation` is exported
// for headless tests; the hook is a thin `useMemo` over it (the flow already
// changes identity only on a real doc mutation, via useYDocFlow).

import { type Diagnostic, type Flow, validate } from '@authprint/dsl';
import { useMemo } from 'react';

export type ValidationResult = {
  diagnostics: Diagnostic[];
  /** Diagnostics that target a node, keyed by node id. */
  byNode: Map<string, Diagnostic[]>;
  /** Diagnostics that target an edge, keyed by edge id. */
  byEdge: Map<string, Diagnostic[]>;
  errorCount: number;
  warningCount: number;
};

function push(map: Map<string, Diagnostic[]>, id: string, d: Diagnostic) {
  const list = map.get(id);
  if (list) list.push(d);
  else map.set(id, [d]);
}

export function computeValidation(flow: Flow): ValidationResult {
  const diagnostics = validate(flow);
  const byNode = new Map<string, Diagnostic[]>();
  const byEdge = new Map<string, Diagnostic[]>();
  let errorCount = 0;
  let warningCount = 0;

  for (const d of diagnostics) {
    if (d.severity === 'error') errorCount++;
    else warningCount++;
    if (d.target?.kind === 'node') push(byNode, d.target.id, d);
    else if (d.target?.kind === 'edge') push(byEdge, d.target.id, d);
    // target-less diagnostics (flow-level, scenario/context) count + list only.
  }

  return { diagnostics, byNode, byEdge, errorCount, warningCount };
}

/** Worst severity in a diagnostic list (error beats warning) — for node/edge styling. */
export function worstSeverity(diagnostics: Diagnostic[] | undefined): 'error' | 'warning' | null {
  if (!diagnostics || diagnostics.length === 0) return null;
  return diagnostics.some((d) => d.severity === 'error') ? 'error' : 'warning';
}

export function useValidation(flow: Flow): ValidationResult {
  return useMemo(() => computeValidation(flow), [flow]);
}
