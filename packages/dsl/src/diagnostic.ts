// Shared diagnostic types. Both the parser (parse-time issues) and the
// validator (structural issues over a parsed Flow) emit Diagnostic[] in this
// shape so consumers (CLI, canvas overlays, CI checks) can treat them
// uniformly.

export type DiagnosticSeverity = 'error' | 'warning';

export type DiagnosticCode =
  // ── Parser codes ─────────────────────────────────────────────────────────
  | 'yaml-parse-error'
  | 'yaml-anchor-rejected'
  | 'yaml-alias-rejected'
  | 'schema-violation'

  // ── Vocabulary warnings (emitted by both parser and validator) ───────────
  | 'vocabulary-unknown-screen-kind'
  | 'vocabulary-unknown-decision-kind'
  | 'vocabulary-unknown-action-kind'
  | 'vocabulary-unknown-external-kind'
  | 'vocabulary-unknown-outcome-kind'
  | 'vocabulary-unknown-field-type'

  // ── Structural validation: graph structure ──────────────────────────────
  | 'validation-entry-missing'
  | 'validation-entry-multiple'
  | 'validation-unreachable-node'
  | 'validation-non-terminable-node'

  // ── Structural validation: edge completeness ────────────────────────────
  | 'validation-decision-branch-missing'
  | 'validation-decision-branch-extra'
  | 'validation-action-missing-success-edge'
  | 'validation-action-missing-error-edge'
  | 'validation-external-missing-success-edge'
  | 'validation-external-missing-error-edge'
  | 'validation-outcome-has-outgoing-edge'
  | 'validation-trigger-incompatible-with-source'

  // ── Structural validation: reference integrity ──────────────────────────
  | 'validation-edge-source-not-found'
  | 'validation-edge-target-not-found'
  | 'validation-annotation-node-not-found'
  | 'validation-annotation-edge-not-found'
  | 'validation-scenario-step-node-not-found'
  | 'validation-scenario-step-type-mismatch'
  | 'validation-scenario-outcome-not-found'
  | 'validation-scenario-sequence-node-not-found'

  // ── Structural validation: context + predicate + scenario context ───────
  | 'validation-predicate-slot-undeclared'
  | 'validation-predicate-op-incompatible'
  | 'validation-predicate-value-type-mismatch'
  | 'validation-scenario-context-slot-undeclared'
  | 'validation-scenario-context-value-type-mismatch';

/**
 * The structural element a diagnostic is about, by id. Lets id-keyed consumers
 * (the canvas validation overlay, codegen, a future LSP) point at the offending
 * node/edge without reconstructing it from the array-index `path`. Absent for
 * flow-level diagnostics (e.g. entry-missing) and parser diagnostics.
 */
export type DiagnosticTarget = { kind: 'node' | 'edge'; id: string };

export type Diagnostic = {
  severity: DiagnosticSeverity;
  code: DiagnosticCode;
  message: string;
  /**
   * JSONPath-style location string (e.g., `nodes[3].kind` or
   * `scenarios[0].inputScript[2].nodeId`). Optional — top-level diagnostics
   * (e.g., entry-missing) carry no path.
   *
   * Position info (line / column) is a v1.x enrichment for IDE-grade
   * diagnostics.
   */
  path?: string;
  /** The node/edge this diagnostic is about (when one applies). */
  target?: DiagnosticTarget;
};

/**
 * True iff `diagnostics` contains no `severity: 'error'` entries.
 * Callers use this as the "is this flow exportable / shippable" gate.
 */
export const isErrorFree = (diagnostics: readonly Diagnostic[]): boolean =>
  diagnostics.every((d) => d.severity !== 'error');
