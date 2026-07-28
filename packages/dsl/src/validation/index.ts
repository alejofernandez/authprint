// validate(): the structural-validation orchestrator.
//
// Runs every check from packages/dsl/src/validation/* and returns a combined
// Diagnostic[]. Pure function over a parsed Flow — no side effects, no I/O.
//
// Severity policy:
//   - error: the flow could not run; red ring on the canvas.
//   - warning: probably a mistake; amber ring.
//   - info: accepted and legal; no canvas cue at all, listed only in Problems.
//
// Use isErrorFree(diagnostics) or canExport(flow) to gate exports.

import { type Diagnostic, isErrorFree } from '../diagnostic.ts';
import type { Flow } from '../schema/flow.ts';
import { checkContextIntegrity } from './context.ts';
import { checkEdgeCompleteness } from './edge-completeness.ts';
import { checkRedundantLinkTraits } from './redundancy.ts';
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
    ...checkRedundantLinkTraits(flow),
  ];

  return sortDiagnostics(diagnostics);
}

/**
 * True iff the flow can be exported as valid DSL — i.e., `validate(flow)`
 * returns no `severity: 'error'` diagnostics.
 *
 * NOTE: this is a predicate for **library consumers** (a CI gate, a publish
 * step, a badge). It is deliberately NOT the editor's policy: Authprint never
 * blocks a write on validation, because it accepts error-bearing files on
 * import and refusing to write them back would strand the author's work.
 * See REQUIREMENTS §6 (revised 2026-07-27).
 *
 * The serializer remains pure (always emits); callers gate exports by
 * consulting this helper separately.
 */
export function canExport(flow: Flow): boolean {
  return isErrorFree(validate(flow));
}

// ─── Deterministic sort ─────────────────────────────────────────────────────
// Order by (severity: error, then warning, then info), then (code
// alphabetical), then (path).
// Produces stable test output as the rule set grows.

function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  const severityRank = (s: Diagnostic['severity']): number =>
    s === 'error' ? 0 : s === 'warning' ? 1 : 2;
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
