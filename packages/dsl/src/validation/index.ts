// validate(): the structural-validation orchestrator.
//
// Runs every check from packages/dsl/src/validation/* and returns a combined
// Diagnostic[]. Pure function over a parsed Flow — no side effects, no I/O.
//
// Severity policy (REQUIREMENTS.md §6 Layer 1):
//   - error: blocks valid DSL export; surfaced as a red ring in the canvas.
//   - warning: doesn't block; surfaced as a yellow indicator.
//
// Use isErrorFree(diagnostics) or canExport(flow) to gate exports.

import { type Diagnostic, isErrorFree } from '../diagnostic.ts';
import type { Flow } from '../schema/flow.ts';
import { checkContextIntegrity } from './context.ts';
import { checkEdgeCompleteness } from './edge-completeness.ts';
import { checkReferences } from './references.ts';
import { checkStructure } from './structure.ts';
import { checkVocabulary } from './vocabulary.ts';

/**
 * Run all structural validation checks on a Flow. Returns a deterministic,
 * sorted Diagnostic[] suitable for diffing in tests.
 *
 * Note: this does NOT run vocabulary checks the parser already ran when
 * loading from YAML — but if you're validating a Flow loaded from another
 * source (e.g., Firestore), call this and it covers vocabulary too.
 */
export function validate(flow: Flow): Diagnostic[] {
  const diagnostics: Diagnostic[] = [
    ...checkStructure(flow),
    ...checkEdgeCompleteness(flow),
    ...checkReferences(flow),
    ...checkContextIntegrity(flow),
    ...checkVocabulary(flow),
  ];

  return sortDiagnostics(diagnostics);
}

/**
 * True iff the flow can be exported as valid DSL — i.e., `validate(flow)`
 * returns no `severity: 'error'` diagnostics. Warnings do not block export.
 *
 * The serializer remains pure (always emits); callers gate exports by
 * consulting this helper separately.
 */
export function canExport(flow: Flow): boolean {
  return isErrorFree(validate(flow));
}

// ─── Deterministic sort ─────────────────────────────────────────────────────
// Order by (severity: error first), then (code alphabetical), then (path).
// Produces stable test output as the rule set grows.

function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  const severityRank = (s: Diagnostic['severity']): number => (s === 'error' ? 0 : 1);
  return [...diagnostics].sort((a, b) => {
    const sevDiff = severityRank(a.severity) - severityRank(b.severity);
    if (sevDiff !== 0) return sevDiff;
    if (a.code !== b.code) return a.code < b.code ? -1 : 1;
    const ap = a.path ?? '';
    const bp = b.path ?? '';
    if (ap !== bp) return ap < bp ? -1 : 1;
    return 0;
  });
}
