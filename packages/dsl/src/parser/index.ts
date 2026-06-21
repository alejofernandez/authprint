// Parser: YAML text → Flow.
//
// Pipeline: yaml.parseDocument (strict 1.2) → reject anchors/aliases → toJS
// → FlowDocumentSchema (zod) → vocabulary check (warnings only).
//
// Position-rich diagnostics from zod errors are deferred to a v1.x pass;
// for now diagnostics carry a JSONPath-style location string from zod.

import { isAlias, isMap, isNode, isPair, isScalar, isSeq, parseDocument } from 'yaml';
import { z } from 'zod';
import type { Flow, FlowDocument } from '../schema/flow.ts';
import { FlowDocumentSchema } from '../schema/flow.ts';
import {
  isBuiltinActionKind,
  isBuiltinDecisionKind,
  isBuiltinExternalKind,
  isBuiltinFieldType,
  isBuiltinOutcomeKind,
  isBuiltinScreenKind,
} from '../vocabulary.ts';

// ─── Diagnostic types ───────────────────────────────────────────────────────

export type DiagnosticSeverity = 'error' | 'warning';

export type DiagnosticCode =
  | 'yaml-parse-error'
  | 'yaml-anchor-rejected'
  | 'yaml-alias-rejected'
  | 'schema-violation'
  | 'vocabulary-unknown-screen-kind'
  | 'vocabulary-unknown-decision-kind'
  | 'vocabulary-unknown-action-kind'
  | 'vocabulary-unknown-external-kind'
  | 'vocabulary-unknown-outcome-kind'
  | 'vocabulary-unknown-field-type';

export type Diagnostic = {
  severity: DiagnosticSeverity;
  code: DiagnosticCode;
  message: string;
  /** JSONPath-style location string. Position info (line/col) is v1.x. */
  path?: string;
};

export type ParseResult = {
  flow: Flow | null;
  document: FlowDocument | null;
  diagnostics: Diagnostic[];
};

// ─── Parse ──────────────────────────────────────────────────────────────────

export function parse(input: string): ParseResult {
  const diagnostics: Diagnostic[] = [];

  // 1. YAML parse with strict 1.2.
  const doc = parseDocument(input, {
    version: '1.2',
    strict: true,
    merge: false,
  });

  for (const err of doc.errors) {
    diagnostics.push({
      severity: 'error',
      code: 'yaml-parse-error',
      message: err.message,
    });
  }
  for (const warn of doc.warnings) {
    diagnostics.push({
      severity: 'warning',
      code: 'yaml-parse-error',
      message: warn.message,
    });
  }

  if (doc.errors.length > 0) {
    return { flow: null, document: null, diagnostics };
  }

  // 2. Reject anchors and aliases. Walk every node in the document.
  const anchorAliasErrors = collectAnchorAndAliasErrors(doc.contents);
  diagnostics.push(...anchorAliasErrors);
  if (anchorAliasErrors.some((d) => d.severity === 'error')) {
    return { flow: null, document: null, diagnostics };
  }

  // 3. Convert to plain JS for zod.
  const raw = doc.toJS();

  // 4. Schema validation.
  const parsed = FlowDocumentSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      diagnostics.push({
        severity: 'error',
        code: 'schema-violation',
        message: issue.message,
        path: issue.path.length > 0 ? formatPath(issue.path) : undefined,
      });
    }
    return { flow: null, document: null, diagnostics };
  }

  // 5. Vocabulary check (warnings only — custom kinds are allowed).
  diagnostics.push(...checkVocabulary(parsed.data));

  return {
    flow: parsed.data.flow,
    document: parsed.data,
    diagnostics,
  };
}

// ─── Anchor / alias walker ──────────────────────────────────────────────────

function collectAnchorAndAliasErrors(contents: unknown): Diagnostic[] {
  const errors: Diagnostic[] = [];

  const visit = (node: unknown): void => {
    if (!isNode(node) && !isPair(node)) return;

    if (isAlias(node)) {
      errors.push({
        severity: 'error',
        code: 'yaml-alias-rejected',
        message: 'YAML aliases are not allowed in Authprint flows',
      });
      return;
    }

    if (isScalar(node) || isMap(node) || isSeq(node)) {
      if ('anchor' in node && node.anchor) {
        errors.push({
          severity: 'error',
          code: 'yaml-anchor-rejected',
          message: `YAML anchor '&${node.anchor}' is not allowed in Authprint flows`,
        });
      }
    }

    if (isMap(node)) {
      for (const item of node.items) {
        visit(item);
      }
    } else if (isSeq(node)) {
      for (const item of node.items) {
        visit(item);
      }
    } else if (isPair(node)) {
      visit(node.key);
      visit(node.value);
    }
  };

  visit(contents);
  return errors;
}

// ─── Vocabulary check ───────────────────────────────────────────────────────

function checkVocabulary(doc: FlowDocument): Diagnostic[] {
  const warnings: Diagnostic[] = [];
  const { flow } = doc;

  flow.nodes.forEach((node, i) => {
    const path = `flow.nodes[${i}].kind`;
    switch (node.type) {
      case 'screen':
        if (!isBuiltinScreenKind(node.kind)) {
          warnings.push(warnUnknownKind('vocabulary-unknown-screen-kind', node.kind, path));
        }
        node.fields.forEach((field, fi) => {
          const fpath = `flow.nodes[${i}].fields[${fi}].type`;
          if (!isBuiltinFieldType(field.type)) {
            warnings.push(warnUnknownKind('vocabulary-unknown-field-type', field.type, fpath));
          }
        });
        break;
      case 'decision':
        if (!isBuiltinDecisionKind(node.kind)) {
          warnings.push(warnUnknownKind('vocabulary-unknown-decision-kind', node.kind, path));
        }
        break;
      case 'action':
        if (!isBuiltinActionKind(node.kind)) {
          warnings.push(warnUnknownKind('vocabulary-unknown-action-kind', node.kind, path));
        }
        break;
      case 'external':
        if (!isBuiltinExternalKind(node.kind)) {
          warnings.push(warnUnknownKind('vocabulary-unknown-external-kind', node.kind, path));
        }
        break;
      case 'outcome':
        if (!isBuiltinOutcomeKind(node.kind)) {
          warnings.push(warnUnknownKind('vocabulary-unknown-outcome-kind', node.kind, path));
        }
        break;
      case 'entry':
        // no kind to check
        break;
    }
  });

  return warnings;
}

function warnUnknownKind(code: DiagnosticCode, value: string, path: string): Diagnostic {
  return {
    severity: 'warning',
    code,
    message: `'${value}' is not in the built-in vocabulary (accepted as custom)`,
    path,
  };
}

// ─── Path formatting ────────────────────────────────────────────────────────

function formatPath(path: ReadonlyArray<string | number | symbol>): string {
  let out = '';
  for (const seg of path) {
    if (typeof seg === 'number') {
      out += `[${seg}]`;
    } else if (typeof seg === 'string') {
      out += out.length === 0 ? seg : `.${seg}`;
    }
  }
  return out;
}

// Re-export the types for consumers.
export type { Flow, FlowDocument };
export { z };
